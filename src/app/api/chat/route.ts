import { streamText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { eq, desc, and, or, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { isUserActive } from "@/lib/auth-helpers";
import db from "@/db";
import {
  bots,
  conversations,
  messages,
  users,
  analyses,
  knowledgeChunks,
} from "@/db/schema";
import { computeCost } from "@/lib/cost";
import {
  buildKnowledgePromptBlock,
  createKnowledgeTools,
  type SearchLogEntry,
} from "@/lib/kb-tools";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isUserActive(session.user.id))) {
    return Response.json({ error: "Акаунтът е деактивиран." }, { status: 403 });
  }

  const { conversationId, botKey, message, newConversation } = await req.json();

  // Load bot config
  const bot = await db
    .select()
    .from(bots)
    .where(eq(bots.key, botKey))
    .then((r) => r[0]);

  if (!bot || !bot.enabled) {
    return Response.json({ error: "Bot not found" }, { status: 404 });
  }

  // Get or create conversation
  let convId = conversationId;
  if (newConversation || !convId) {
    const [newConv] = await db
      .insert(conversations)
      .values({
        userId: session.user.id,
        botId: bot.id,
        kind: bot.kind,
        title: bot.title,
        status: "active",
      })
      .returning({ id: conversations.id });
    convId = newConv.id;
  } else {
    // Verify ownership
    const conv = await db
      .select({ userId: conversations.userId })
      .from(conversations)
      .where(eq(conversations.id, convId))
      .then((r) => r[0]);

    const role = session.user.role;
    const isAdminOrIT = role === "admin" || role === "it";
    if (!conv || (conv.userId !== session.user.id && !isAdminOrIT)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Save user message
  await db.insert(messages).values({
    conversationId: convId,
    role: "user",
    content: message,
  });

  // Update conversation last activity
  await db
    .update(conversations)
    .set({ lastActivityAt: new Date() })
    .where(eq(conversations.id, convId));

  // Update user lastActiveAt
  await db
    .update(users)
    .set({ lastActiveAt: new Date() })
    .where(eq(users.id, session.user.id));

  // Build message history for the LLM
  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, convId),
        ne(messages.role, "system")
      )
    )
    .orderBy(messages.createdAt);

  // Build system prompt — for consultant, inject RAG context + user history
  let systemPrompt = bot.systemPrompt;
  const isConsultant = bot.kind === "consultant";
  const searchLog: SearchLogEntry[] = [];

  if (isConsultant) {
    // RAG: retrieve relevant knowledge chunks
    const ragContext = await getRAGContext(message, session.user.id, session.user.role);
    systemPrompt += `\n\n---\n## Съдържание на обучението (извлечено по релевантност)\n${
      ragContext.courseContent ||
      "(Към този въпрос не са намерени подходящи откъси. Ако ти трябва детайл, потърси с инструмента searchCompanyKnowledge.)"
    }`;
    if (ragContext.userHistory) {
      systemPrompt += `\n\n## Последни разговори и анализи на потребителя\n${ragContext.userHistory}`;
    }
    // Последен в промпта — за да не бъде заглушен от правилата „извън обхвата“ по-горе.
    systemPrompt += `\n\n---\n${await buildKnowledgePromptBlock()}`;
  }

  // Stream from OpenAI
  const result = streamText({
    model: openai(bot.model),
    system: systemPrompt,
    messages: history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    temperature: bot.temperature,
    maxOutputTokens: bot.maxTokens,
    // Само Роби търси в базата знания; симулациите на клиенти нямат инструменти.
    ...(isConsultant
      ? { tools: createKnowledgeTools(searchLog), stopWhen: stepCountIs(3) }
      : {}),
    onFinish: async ({ steps, totalUsage }) => {
      // Текстът, който потребителят е видял, е съединение на всички стъпки.
      const text = steps.map((s) => s.text).join("");
      const tokensIn = totalUsage?.inputTokens ?? 0;
      const tokensOut = totalUsage?.outputTokens ?? 0;
      const cost = await computeCost(bot.model, tokensIn, tokensOut);

      await db.insert(messages).values({
        conversationId: convId,
        role: "assistant",
        content: text,
        model: bot.model,
        tokensIn,
        tokensOut,
        cost,
        meta: searchLog.length > 0 ? { searches: searchLog } : null,
      });
    },
  });

  // Return conversationId in headers so client can persist it
  const response = result.toTextStreamResponse();
  const headers = new Headers(response.headers);
  headers.set("X-Conversation-Id", convId);

  return new Response(response.body, {
    headers,
    status: response.status,
  });
}

async function getRAGContext(query: string, userId: string, userRole: string) {
  let courseContent = "";
  let userHistory = "";

  try {
    // Simple keyword-based retrieval (embeddings require OpenAI API key)
    // If OPENAI_API_KEY is set, do vector search; else fall back to text search
    if (process.env.OPENAI_API_KEY) {
      const { openai: oai } = await import("@ai-sdk/openai");
      const { embed } = await import("ai");
      const { cosineDistance, sql, gt } = await import("drizzle-orm");

      const embedding = await embed({
        model: oai.embedding("text-embedding-3-small"),
        value: query,
      });

      const chunks = await db
        .select({
          title: knowledgeChunks.title,
          content: knowledgeChunks.content,
          similarity: sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, embedding.embedding)})`,
        })
        .from(knowledgeChunks)
        .where(
          and(
            // само дървото — качените документи се четат с инструмента, при нужда
            eq(knowledgeChunks.source, "tree"),
            gt(
              sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, embedding.embedding)})`,
              // Мерено върху реалните откъси: верните откъси излизат с 0.44–0.58, а
              // несвързани въпроси не минават 0.35. С 0.6 не се връщаше нищо.
              0.42
            )
          )
        )
        .orderBy(
          sql`1 - (${cosineDistance(knowledgeChunks.embedding, embedding.embedding)}) DESC`
        )
        .limit(4);

      courseContent = chunks
        .map((c) => `### ${c.title ?? "Раздел"}\n${c.content}`)
        .join("\n\n");
    } else {
      // Fallback: return first 3 chunks
      const chunks = await db
        .select({ title: knowledgeChunks.title, content: knowledgeChunks.content })
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.source, "tree"))
        .limit(3);
      courseContent = chunks
        .map((c) => `### ${c.title ?? "Раздел"}\n${c.content}`)
        .join("\n\n");
    }
  } catch {
    courseContent = "(Базата знания не е индексирана все още.)";
  }

  // User conversation history
  try {
    const convQuery = db
      .select({
        id: conversations.id,
        title: conversations.title,
        startedAt: conversations.startedAt,
        status: conversations.status,
      })
      .from(conversations)
      // Винаги само разговорите на самия потребител (и за admin/it — не чужди разговори).
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.lastActivityAt))
      .limit(5);

    const recentConvs = await convQuery;

    const historyParts: string[] = [];
    for (const conv of recentConvs) {
      const analysis = await db
        .select({ overallScore: analyses.overallScore, summary: analyses.summary })
        .from(analyses)
        .where(eq(analyses.conversationId, conv.id))
        .then((r) => r[0]);

      const lastMessages = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(4);

      const preview = lastMessages
        .reverse()
        .map((m) => `${m.role === "user" ? "Консултант" : "Клиент"}: ${m.content.slice(0, 120)}`)
        .join("\n");

      historyParts.push(
        `**${conv.title}** (${conv.startedAt.toLocaleDateString("bg")})${analysis ? ` — Оценка: ${analysis.overallScore}/10. ${analysis.summary}` : ""}\n${preview}`
      );
    }

    userHistory = historyParts.join("\n\n---\n\n");
  } catch {
    userHistory = "";
  }

  return { courseContent, userHistory };
}
