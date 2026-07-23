import { and, eq, lt } from "drizzle-orm";
import db from "@/db";
import { conversations } from "@/db/schema";

/** Simulations idle for longer than this are considered abandoned. */
export const STALE_SIMULATION_DAYS = 7;

/**
 * Marks the user's own stale, still-"active" simulation conversations as
 * "abandoned". Cheap DB-only operation — does NOT run any LLM analysis.
 */
export async function abandonStaleSimulations(userId: string): Promise<void> {
  const staleBefore = new Date(
    Date.now() - STALE_SIMULATION_DAYS * 24 * 60 * 60 * 1000
  );

  await db
    .update(conversations)
    .set({ status: "abandoned" })
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.kind, "simulation"),
        eq(conversations.status, "active"),
        lt(conversations.lastActivityAt, staleBefore)
      )
    );
}
