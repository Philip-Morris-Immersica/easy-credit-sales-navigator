import { and, eq, lt, sql } from "drizzle-orm";
import db from "@/db";
import { conversations, messages } from "@/db/schema";
import { MIN_USER_TURNS_FOR_ANALYSIS } from "@/lib/analysis-config";
import { generateAnalysisForConversation } from "@/lib/analysis";

/** Simulations idle for longer than this are considered abandoned. */
export const STALE_SIMULATION_DAYS = 7;

/**
 * Resolves a single stale "active" simulation (#2.7):
 * - Enough consultant turns → auto-analyse (marked "completed") so the trainee
 *   still gets feedback; the analysis is told the conversation was unfinished
 *   so it doesn't penalise unreached stages. (Only when `analyse` is true.)
 * - Otherwise (or on analysis failure) → simply marked "abandoned".
 */
async function resolveStaleConversation(
  id: string,
  analyse: boolean
): Promise<"analysed" | "abandoned"> {
  if (analyse) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.conversationId, id), eq(messages.role, "user")));
    const userTurns = row?.count ?? 0;

    if (userTurns >= MIN_USER_TURNS_FOR_ANALYSIS) {
      try {
        await generateAnalysisForConversation(id, { incomplete: true });
        return "analysed";
      } catch {
        // fall through to abandon so it doesn't stay stuck "active"
      }
    }
  }

  await db
    .update(conversations)
    .set({ status: "abandoned" })
    .where(eq(conversations.id, id));
  return "abandoned";
}

/**
 * Cleans up ONE user's stale simulations. Runs lazily when the user opens /me,
 * so in practice this touches zero or very few conversations per visit.
 */
export async function abandonStaleSimulations(userId: string): Promise<void> {
  const staleBefore = new Date(
    Date.now() - STALE_SIMULATION_DAYS * 24 * 60 * 60 * 1000
  );

  const stale = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.kind, "simulation"),
        eq(conversations.status, "active"),
        lt(conversations.lastActivityAt, staleBefore)
      )
    );

  for (const s of stale) {
    await resolveStaleConversation(s.id, true);
  }
}

/**
 * Global sweep across ALL users — the per-user lazy cleanup only fires when
 * that specific user opens /me, so sessions of users who never return would
 * otherwise linger as "active" forever. Meant to be run on a schedule (Vercel
 * Cron) and can also be invoked as a one-off maintenance script.
 *
 * @param analyse when true, long unfinished sessions are auto-analysed before
 *   closing; when false they're just marked "abandoned" (cheap, no LLM cost —
 *   useful for clearing an old backlog).
 */
export async function sweepStaleSimulations(
  analyse = true
): Promise<{ total: number; analysed: number; abandoned: number }> {
  const staleBefore = new Date(
    Date.now() - STALE_SIMULATION_DAYS * 24 * 60 * 60 * 1000
  );

  const stale = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.kind, "simulation"),
        eq(conversations.status, "active"),
        lt(conversations.lastActivityAt, staleBefore)
      )
    );

  let analysed = 0;
  let abandoned = 0;
  for (const s of stale) {
    const result = await resolveStaleConversation(s.id, analyse);
    if (result === "analysed") analysed++;
    else abandoned++;
  }

  return { total: stale.length, analysed, abandoned };
}
