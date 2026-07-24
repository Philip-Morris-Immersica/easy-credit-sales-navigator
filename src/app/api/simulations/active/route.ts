import { auth } from "@/auth";
import { isUserActive } from "@/lib/auth-helpers";
import db from "@/db";
import { conversations, bots, messages } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Returns the user's current unfinished simulation, if any — used to enforce
 * "one simulation at a time" (#2.7). A simulation counts as unfinished when it
 * is kind=simulation, status=active and already has at least one consultant
 * (user) reply, so merely opening and closing a scenario doesn't block anything.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserActive(session.user.id))) {
    return Response.json({ error: "Акаунтът е деактивиран." }, { status: 403 });
  }

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      botKey: bots.key,
      botTitle: bots.title,
      userTurns: sql<number>`count(*) filter (where ${messages.role} = 'user')::int`,
    })
    .from(conversations)
    .leftJoin(bots, eq(conversations.botId, bots.id))
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, session.user.id),
        eq(conversations.kind, "simulation"),
        eq(conversations.status, "active")
      )
    )
    .groupBy(conversations.id, conversations.title, bots.key, bots.title)
    .orderBy(desc(conversations.lastActivityAt));

  const active = rows.find((r) => (r.userTurns ?? 0) > 0);
  if (!active) return Response.json({ active: null });

  return Response.json({
    active: {
      conversationId: active.id,
      botKey: active.botKey,
      title: active.botTitle ?? active.title ?? "Симулация",
    },
  });
}

/**
 * Marks the user's active (unfinished) simulations as "abandoned" — used by the
 * "discard unfinished" action so the trainee can start a new one without being
 * stuck. The discarded session stays visible in the profile and can still be
 * analysed on demand.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserActive(session.user.id))) {
    return Response.json({ error: "Акаунтът е деактивиран." }, { status: 403 });
  }

  const updated = await db
    .update(conversations)
    .set({ status: "abandoned" })
    .where(
      and(
        eq(conversations.userId, session.user.id),
        eq(conversations.kind, "simulation"),
        eq(conversations.status, "active")
      )
    )
    .returning({ id: conversations.id });

  return Response.json({ ok: true, count: updated.length });
}
