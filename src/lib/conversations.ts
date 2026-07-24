import { and, eq, lt, sql } from "drizzle-orm";
import db from "@/db";
import { conversations, messages } from "@/db/schema";
import { MIN_USER_TURNS_FOR_ANALYSIS } from "@/lib/analysis-config";
import { generateAnalysisForConversation } from "@/lib/analysis";

/** Simulations idle for longer than this are considered abandoned. */
export const STALE_SIMULATION_DAYS = 7;

/**
 * Cleans up the user's stale, still-"active" simulation conversations (#2.7):
 * - Sessions with enough consultant turns are auto-analysed (marked
 *   "completed") so the trainee still gets feedback; the analysis is told the
 *   conversation was left unfinished so it doesn't penalise unreached stages.
 * - Shorter sessions are simply marked "abandoned".
 *
 * Runs lazily when the user opens /me. Stale = idle for STALE_SIMULATION_DAYS,
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

  if (stale.length === 0) return;

  for (const s of stale) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.conversationId, s.id), eq(messages.role, "user")));
    const userTurns = row?.count ?? 0;

    if (userTurns >= MIN_USER_TURNS_FOR_ANALYSIS) {
      // Long enough to be worth analysing — generate feedback and mark completed.
      try {
        await generateAnalysisForConversation(s.id, { incomplete: true });
      } catch {
        // If the LLM call fails, don't leave it stuck "active".
        await db
          .update(conversations)
          .set({ status: "abandoned" })
          .where(eq(conversations.id, s.id));
      }
    } else {
      await db
        .update(conversations)
        .set({ status: "abandoned" })
        .where(eq(conversations.id, s.id));
    }
  }
}
