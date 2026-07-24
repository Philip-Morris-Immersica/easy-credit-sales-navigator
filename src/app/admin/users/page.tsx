import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { users, conversations } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { UsersClient } from "@/components/admin/UsersClient";

export default async function AdminUsersPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
      convCount: count(conversations.id),
    })
    .from(users)
    .leftJoin(conversations, eq(conversations.userId, users.id))
    .groupBy(users.id)
    .orderBy(users.createdAt);

  return <UsersClient rows={rows} />;
}
