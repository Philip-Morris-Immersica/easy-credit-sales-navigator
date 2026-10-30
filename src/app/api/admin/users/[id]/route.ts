import { auth } from "@/auth";
import db from "@/db";
import { users, auditLog, conversations, messages, analyses } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { normalizeName } from "@/lib/names";
import { getAdminApiUser } from "@/lib/auth-helpers";
import { costRollupsTableExists, purgeUserQuery } from "@/lib/retention";

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
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .then((r) => r[0]);

  if (!user) return Response.json({ error: "Not found" }, { status: 404 });

  // Същото правило като при ролите и изтриването: admin не пипа it.
  if (session.user.role === "admin" && user.role === "it") {
    return Response.json(
      { error: "Нямате право да променяте IT потребители." },
      { status: 403 }
    );
  }

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

/**
 * Окончателно изтриване на потребител (Т5).
 *
 * Базата трие каскадно: сесии, акаунти, токени, разговори → съобщения → анализи.
 * Документите в „База знания", версиите на ботовете и журналът с действията
 * НЕ се трият — колоните `uploaded_by` / `changed_by` / `actor_id` са `set null`.
 *
 * Изисква в тялото `confirmEmail` да съвпада с имейла на потребителя
 * (двойното потвърждение се налага и на сървъра, не само в интерфейса).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAdminApiUser();
  if (!actor) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (id === actor.id) {
    return Response.json(
      { error: "Не можете да изтриете собствения си акаунт." },
      { status: 400 }
    );
  }

  const target = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .then((r) => r[0]);
  if (!target) return Response.json({ error: "Not found" }, { status: 404 });

  // Същото правило като при ролите: admin не пипа it.
  if (actor.role === "admin" && target.role === "it") {
    return Response.json(
      { error: "Нямате право да изтривате IT потребители." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { confirmEmail?: unknown };
  const confirmEmail =
    typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
  if (confirmEmail !== target.email.trim().toLowerCase()) {
    return Response.json(
      { error: "Имейлът за потвърждение не съвпада." },
      { status: 400 }
    );
  }

  // Броим преди изтриването — за журнала (без лични данни).
  const [convCount] = await db
    .select({ n: count() })
    .from(conversations)
    .where(eq(conversations.userId, id));
  const [msgCount] = await db
    .select({ n: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, id));
  const [anCount] = await db
    .select({ n: count() })
    .from(analyses)
    .innerJoin(conversations, eq(analyses.conversationId, conversations.id))
    .where(eq(conversations.userId, id));

  // Разходите минават в cost_rollups преди триенето, иначе изчезват от справките.
  // Преди миграцията 0001_cost_rollups таблицата я няма — тогава каскадата трие и тях.
  if (await costRollupsTableExists()) {
    await db.execute(purgeUserQuery(id));
  }
  await db.delete(users).where(eq(users.id, id));

  // Само броячи — без име, имейл и съдържание.
  await db.insert(auditLog).values({
    actorId: actor.id,
    action: "user.delete",
    target: id,
    meta: {
      conversations: convCount?.n ?? 0,
      messages: msgCount?.n ?? 0,
      analyses: anCount?.n ?? 0,
    },
  });

  return Response.json({ success: true });
}
