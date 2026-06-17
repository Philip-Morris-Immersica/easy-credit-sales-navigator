import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import db from "@/db";
import { conversations, messages, bots, analyses } from "@/db/schema";
import { computeCost } from "@/lib/cost";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await req.json();

  // Load conversation
  const conv = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .then((r) => r[0]);

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });
  if (conv.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (conv.kind !== "simulation") {
    return Response.json({ error: "Analysis only available for simulations" }, { status: 400 });
  }

  // Check if already analysed
  const existing = await db
    .select({ id: analyses.id })
    .from(analyses)
    .where(eq(analyses.conversationId, conversationId))
    .then((r) => r[0]);

  if (existing) {
    const full = await db.select().from(analyses).where(eq(analyses.id, existing.id)).then(r => r[0]);
    return Response.json({ analysis: full });
  }

  // Load bot
  const bot = await db
    .select()
    .from(bots)
    .where(eq(bots.id, conv.botId))
    .then((r) => r[0]);

  if (!bot?.analysisPrompt) {
    return Response.json({ error: "No analysis prompt configured" }, { status: 400 });
  }

  // Load messages
  const msgs = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const transcript = msgs
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "Консултант" : "Клиент"}: ${m.content}`)
    .join("\n");

  // Mark conversation as completed
  await db
    .update(conversations)
    .set({ status: "completed" })
    .where(eq(conversations.id, conversationId));

  // Run analysis
  const analysisModel = "gpt-4.1-mini";
  const { text, usage } = await generateText({
    model: openai(analysisModel),
    system: bot.analysisPrompt,
    prompt: `Разговор:\n${transcript}`,
    maxOutputTokens: 1500,
  });

  const cost = await computeCost(
    analysisModel,
    usage?.inputTokens ?? 0,
    usage?.outputTokens ?? 0
  );

  // Parse JSON response
  let parsed: Record<string, unknown> = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    parsed = { summary: text };
  }

  const [analysis] = await db
    .insert(analyses)
    .values({
      conversationId,
      botId: bot.id,
      overallScore: (parsed.overallScore as number) ?? null,
      criteria: (parsed.criteria as object) ?? null,
      strengths: (parsed.strengths as string[]) ?? [],
      improvements: (parsed.improvements as string[]) ?? [],
      summary: (parsed.summary as string) ?? null,
      rawJson: parsed,
      model: analysisModel,
    })
    .returning();

  return Response.json({ analysis, cost });
}
