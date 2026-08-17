import { auth } from "@/auth";
import db from "@/db";
import { users, auditLog } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const VALID_ROLES = ["user", "admin", "it"] as const;
type AppRole = (typeof VALID_ROLES)[number];

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && VALID_ROLES.includes(value as AppRole);
}

export async function POST(req: Request) {
  const session = await auth();
  const actorRole = session?.user?.role;
  if (!session?.user || (actorRole !== "admin" && actorRole !== "it")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const query = String(body.query ?? body.email ?? "").trim();
  const role = body.role;

  if (!query) {
    return Response.json({ error: "Въведете имейл или име." }, { status: 400 });
  }
  if (!isAppRole(role)) {
    return Response.json({ error: "Невалидна роля." }, { status: 400 });
  }

  if (actorRole === "admin" && role === "it") {
    return Response.json(
      { error: "Само IT може да дава IT достъп." },
      { status: 403 }
    );
  }

  const emailMatch = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, query.toLowerCase()))
    .then((r) => r[0]);

  let target = emailMatch;
  if (!target) {
    const nameMatches = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(sql`lower(${users.name}) = ${query.toLowerCase()}`);

    if (nameMatches.length > 1) {
      return Response.json(
        {
          error:
            "Намерени са няколко потребители с това име. Изберете от списъка или използвайте имейл.",
        },
        { status: 409 }
      );
    }
    target = nameMatches[0];
  }

  if (!target) {
    return Response.json({ error: "Потребителят не е намерен." }, { status: 404 });
  }

  if (actorRole === "admin" && target.role === "it") {
    return Response.json(
      { error: "Нямате право да променяте IT потребители." },
      { status: 403 }
    );
  }

  if (target.id === session.user.id) {
    return Response.json(
      { error: "Не можете да променяте собствената си роля." },
      { status: 400 }
    );
  }

  await db.update(users).set({ role }).where(eq(users.id, target.id));

  await db.insert(auditLog).values({
    actorId: session.user.id,
    action: "user.role.set",
    target: target.email,
    meta: { role },
  });

  return Response.json({ success: true });
}
