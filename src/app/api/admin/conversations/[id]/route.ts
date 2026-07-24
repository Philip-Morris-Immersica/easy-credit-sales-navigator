import { auth } from "@/auth";
import db from "@/db";
import { conversations, messages, analyses, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "it")) {
    return Response.json({ error: "Forbidden — admin or IT access required" }, { status: 403 });
  }

  const { id } = await params;

  const conv = await db
    .select({
      id: conversations.id,
      userId: conversations.userId,
      title: conversations.title,
      kind: conversations.kind,
    })
    .from(conversations)
    .where(eq(conversations.id, id))
    .then((r) => r[0]);

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });

  // Cascade deletes messages and analyses due to FK onDelete: cascade
  await db.delete(conversations).where(eq(conversations.id, id));

  // Audit trail — deletion is irreversible, so record who did it and on what.
  await db.insert(auditLog).values({
    actorId: session.user.id,
    action: "conversation.delete",
    target: id,
    meta: { userId: conv.userId, title: conv.title, kind: conv.kind },
  });

  return Response.json({ success: true });
}
