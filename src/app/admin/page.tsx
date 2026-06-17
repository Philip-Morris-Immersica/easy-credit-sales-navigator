import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { users, conversations, messages, analyses } from "@/db/schema";
import { count, sum, eq, gte, countDistinct } from "drizzle-orm";
import { AdminDashboardCharts } from "@/components/admin/AdminDashboardCharts";

async function getStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [activeUsers] = await db
    .select({ count: countDistinct(conversations.userId) })
    .from(conversations)
    .where(gte(conversations.lastActivityAt, sevenDaysAgo));
  const [totalConvs] = await db.select({ count: count() }).from(conversations);
  const [costResult] = await db
    .select({ total: sum(messages.cost) })
    .from(messages)
    .where(gte(messages.createdAt, thirtyDaysAgo));

  return {
    totalUsers: totalUsers.count,
    activeUsers: activeUsers.count,
    totalConversations: totalConvs.count,
    costThisMonth: parseFloat(costResult.total ?? "0"),
  };
}

async function getTopUsers() {
  const rows = await db
    .select({
      name: users.name,
      email: users.email,
      count: count(conversations.id),
    })
    .from(users)
    .leftJoin(conversations, eq(conversations.userId, users.id))
    .groupBy(users.id, users.name, users.email)
    .orderBy(count(conversations.id))
    .limit(5);
  return rows.sort((a, b) => b.count - a.count);
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getStats();
  const topUsers = await getTopUsers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="t-heading font-bold text-foreground">Дашборд</h1>
        <p className="t-body text-muted-foreground">Преглед на платформата</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Общо потребители", value: stats.totalUsers },
          { label: "Активни потребители", value: stats.activeUsers, sub: "последните 7 дни" },
          { label: "Разговори", value: stats.totalConversations },
          { label: "Разход тazi месец", value: `$${stats.costThisMonth.toFixed(4)}` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-5">
            <p className="t-small text-muted-foreground">{s.label}</p>
            {s.sub && <p className="t-small text-muted-foreground/70">{s.sub}</p>}
            <p className="t-heading font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <AdminDashboardCharts />

      {/* Top users */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="t-subheading font-semibold mb-4">Топ активни потребители (30д)</h2>
        <div className="space-y-2">
          {topUsers.map((u) => (
            <div key={u.email} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <div>
                <p className="t-body font-medium">{u.name ?? "—"}</p>
                <p className="t-small text-muted-foreground">{u.email}</p>
              </div>
              <span className="t-body font-medium">{u.count} разговора</span>
            </div>
          ))}
          {topUsers.length === 0 && (
            <p className="t-body text-muted-foreground text-center py-4">Няма данни.</p>
          )}
        </div>
      </div>
    </div>
  );
}
