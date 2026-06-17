import { requireIT } from "@/lib/auth-helpers";
import db from "@/db";
import { users } from "@/db/schema";
import { ne } from "drizzle-orm";
import { AdminRoleManager } from "@/components/admin/AdminRoleManager";

export default async function AdminAdminsPage() {
  await requireIT();

  const allUsers = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .orderBy(users.email);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="t-heading font-bold">Администратори</h1>
        <p className="t-body text-muted-foreground">Управление на роли. Достъпно само за IT.</p>
      </div>
      <AdminRoleManager users={allUsers} />
    </div>
  );
}
