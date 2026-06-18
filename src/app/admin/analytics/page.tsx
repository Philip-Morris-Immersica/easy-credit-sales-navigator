import { requireAdmin } from "@/lib/auth-helpers";
import { AnalyticsClient } from "@/components/admin/AnalyticsClient";

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  return <AnalyticsClient />;
}
