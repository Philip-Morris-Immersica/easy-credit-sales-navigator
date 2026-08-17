import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { users } from "@/db/schema";
import { AdminRoleManager } from "@/components/admin/AdminRoleManager";

export default async function AdminAdminsPage() {
  const currentUser = await requireAdmin();
  const isIT = currentUser.role === "it";

  const allUsers = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .orderBy(users.email);

  const visibleUsers = isIT ? allUsers : allUsers.filter((u) => u.role !== "it");

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="t-heading font-bold">Администратори</h1>
        <p className="t-body text-muted-foreground">
          {isIT
            ? "Управление на роли. Само IT може да дава IT достъп."
            : "Можете да задавате роли admin и user. IT достъп се дава само от IT."}
        </p>
      </div>
      <AdminRoleManager
        users={visibleUsers}
        currentRole={currentUser.role}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
