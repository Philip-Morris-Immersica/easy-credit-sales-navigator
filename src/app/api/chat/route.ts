import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { eq, desc, and, or, ne } from "drizzle-orm";
import { auth } from "@/auth";
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

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    // Guard: a user may not start a new simulation while a previously
    // started one is still active. Empty/never-started active simulations
    // (no user messages yet) don't count — they don't block a new attempt.
    if (bot.kind === "simulation") {
      const activeSims = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, session.user.id),
            eq(conversations.kind, "simulation"),
            eq(conversations.status, "active")
          )
        );

      for (const sim of activeSims) {
        const hasUserMessage = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(eq(messages.conversationId, sim.id), eq(messages.role, "user"))
          )
          .limit(1)
          .then((r) => r.length > 0);

        if (hasUserMessage) {
          return Response.json(
            {
              error:
                "Имаш незавършена симулация. Приключи я (бутон „Анализирай разговора\") преди да започнеш нова.",
              code: "ACTIVE_SIMULATION_EXISTS",
              conversationId: sim.id,
            },
            { status: 409 }
          );
        }
      }
    }

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

  if (bot.kind === "consultant") {
    // RAG: retrieve relevant knowledge chunks
    const ragContext = await getRAGContext(message, session.user.id, session.user.role);
    systemPrompt += `\n\n---\n## Съдържание на обучението (извлечено по релевантност)\n${ragContext.courseContent}`;
    if (ragContext.userHistory) {
      systemPrompt += `\n\n## Последни разговори и анализи на потребителя\n${ragContext.userHistory}`;
    }
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
    onFinish: async ({ text, usage }) => {
      const tokensIn = usage?.inputTokens ?? 0;
      const tokensOut = usage?.outputTokens ?? 0;
      const cost = await computeCost(bot.model, tokensIn, tokensOut);

      await db.insert(messages).values({
        conversationId: convId,
        role: "assistant",
        content: text,
        model: bot.model,
        tokensIn,
        tokensOut,
        cost,
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
            gt(
              sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, embedding.embedding)})`,
              0.6
            )
          )
        )
        .orderBy(
          sql`1 - (${cosineDistance(knowledgeChunks.embedding, embedding.embedding)}) DESC`
        )
        .limit(6);

      courseContent = chunks
        .map((c) => `### ${c.title ?? "Раздел"}\n${c.content}`)
        .join("\n\n");
    } else {
      // Fallback: return first 3 chunks
      const chunks = await db
        .select({ title: knowledgeChunks.title, content: knowledgeChunks.content })
        .from(knowledgeChunks)
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
    const isAdminOrIT = userRole === "admin" || userRole === "it";
    const convQuery = db
      .select({
        id: conversations.id,
        title: conversations.title,
        startedAt: conversations.startedAt,
        status: conversations.status,
      })
      .from(conversations)
      .where(
        isAdminOrIT
          ? undefined
          : eq(conversations.userId, userId)
      )
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
