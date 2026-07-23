import { auth } from "@/auth";
import db from "@/db";
import { users, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "it")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { active } = await req.json();

  if (typeof active !== "boolean") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (id === session.user.id) {
    return Response.json(
      { error: "Не можете да деактивирате собствения си акаунт." },
      { status: 400 }
    );
  }

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .then((r) => r[0]);

  if (!user) return Response.json({ error: "Not found" }, { status: 404 });

  await db.update(users).set({ active }).where(eq(users.id, id));

  await db.insert(auditLog).values({
    actorId: session.user.id,
    action: active ? "user.activate" : "user.deactivate",
    target: id,
    meta: { active },
  });

  return Response.json({ success: true });
}
