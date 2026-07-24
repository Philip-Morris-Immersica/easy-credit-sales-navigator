import { auth } from "@/auth";
import db from "@/db";
import { users, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeName } from "@/lib/names";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "it")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as { active?: unknown; name?: unknown };

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .then((r) => r[0]);

  if (!user) return Response.json({ error: "Not found" }, { status: 404 });

  let didSomething = false;

  // Rename (#A2.2) — lets admins fix corrupted display names.
  if (typeof body.name === "string") {
    const cleanName = normalizeName(body.name);
    if (!cleanName) {
      return Response.json({ error: "Името не може да бъде празно." }, { status: 400 });
    }
    await db.update(users).set({ name: cleanName }).where(eq(users.id, id));
    await db.insert(auditLog).values({
      actorId: session.user.id,
      action: "user.rename",
      target: id,
      meta: { name: cleanName },
    });
    didSomething = true;
  }

  // Activate / deactivate.
  if (typeof body.active === "boolean") {
    if (id === session.user.id) {
      return Response.json(
        { error: "Не можете да деактивирате собствения си акаунт." },
        { status: 400 }
      );
    }
    await db.update(users).set({ active: body.active }).where(eq(users.id, id));
    await db.insert(auditLog).values({
      actorId: session.user.id,
      action: body.active ? "user.activate" : "user.deactivate",
      target: id,
      meta: { active: body.active },
    });
    didSomething = true;
  }

  if (!didSomething) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  return Response.json({ success: true });
}
