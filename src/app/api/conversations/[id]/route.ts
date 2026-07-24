import { auth } from "@/auth";
import { isUserActive } from "@/lib/auth-helpers";
import db from "@/db";
import { conversations, messages, analyses } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserActive(session.user.id))) {
    return Response.json({ error: "Акаунтът е деактивиран." }, { status: 403 });
  }

  const { id } = await params;
  const role = session.user.role;
  const isAdminOrIT = role === "admin" || role === "it";

  const conv = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .then((r) => r[0]);

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });
  if (!isAdminOrIT && conv.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const analysis = await db
    .select()
    .from(analyses)
    .where(eq(analyses.conversationId, id))
    .then((r) => r[0] ?? null);

  return Response.json({ conversation: conv, messages: msgs, analysis });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserActive(session.user.id))) {
    return Response.json({ error: "Акаунтът е деактивиран." }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();

  const conv = await db
    .select({ userId: conversations.userId })
    .from(conversations)
    .where(eq(conversations.id, id))
    .then((r) => r[0]);

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });
  if (conv.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .update(conversations)
    .set({ status, lastActivityAt: new Date() })
    .where(eq(conversations.id, id));

  return Response.json({ success: true });
}
