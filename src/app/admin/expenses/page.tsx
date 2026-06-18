import { requireAdmin } from "@/lib/auth-helpers";
import { ExpensesClient } from "@/components/admin/ExpensesClient";

export default async function AdminExpensesPage() {
  await requireAdmin();
  return <ExpensesClient />;
}
