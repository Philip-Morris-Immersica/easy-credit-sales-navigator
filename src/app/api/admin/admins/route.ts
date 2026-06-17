import { auth } from "@/auth";
import db from "@/db";
import { users, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "it") {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  const { email, role } = await req.json();

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .then((r) => r[0]);

  if (!user) {
    return Response.json({ error: "Потребителят не е намерен." }, { status: 404 });
  }

  await db.update(users).set({ role }).where(eq(users.id, user.id));

  await db.insert(auditLog).values({
    actorId: session.user.id,
    action: "user.role.set",
    target: email,
    meta: { role },
  });

  return Response.json({ success: true });
}
