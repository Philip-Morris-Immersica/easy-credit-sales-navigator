import { auth } from "@/auth";
import db from "@/db";
import { conversations, messages, analyses } from "@/db/schema";
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
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, id))
    .then((r) => r[0]);

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });

  // Cascade deletes messages and analyses due to FK onDelete: cascade
  await db.delete(conversations).where(eq(conversations.id, id));

  return Response.json({ success: true });
}
