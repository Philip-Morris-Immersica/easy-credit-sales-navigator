import { requireAdmin } from "@/lib/auth-helpers";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const session = await auth();
  const role = session?.user?.role ?? "admin";

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar role={role} />
      <main className="flex-1 ml-60 p-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
