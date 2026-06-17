import { requireAdmin } from "@/lib/auth-helpers";
import { ReportsClient } from "@/components/admin/ReportsClient";

export default async function AdminReportsPage() {
  await requireAdmin();
  return <ReportsClient />;
}
