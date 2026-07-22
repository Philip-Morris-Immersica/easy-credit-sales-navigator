import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { users, conversations, messages, analyses, bots } from "@/db/schema";
import { count, sum, eq, gte, countDistinct, and, lt, desc } from "drizzle-orm";
import { AdminDashboardCharts } from "@/components/admin/AdminDashboardCharts";
import Link from "next/link";

async function getStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [activeUsers7d] = await db
    .select({ count: countDistinct(conversations.userId) })
    .from(conversations)
    .where(gte(conversations.lastActivityAt, sevenDaysAgo));
  const [activeUsers30d] = await db
    .select({ count: countDistinct(conversations.userId) })
    .from(conversations)
    .where(gte(conversations.lastActivityAt, thirtyDaysAgo));
  const [totalConvs] = await db.select({ count: count() }).from(conversations);
  const [totalAnalyses] = await db.select({ count: count() }).from(analyses);
  const [costResult] = await db
    .select({
      total: sum(messages.cost),
      totalTokensIn: sum(messages.tokensIn),
      totalTokensOut: sum(messages.tokensOut),
    })
    .from(messages)
    .where(gte(messages.createdAt, startOfMonth));

  return {
    totalUsers: totalUsers.count,
    activeUsers7d: activeUsers7d.count,
    activeUsers30d: activeUsers30d.count,
    totalConversations: totalConvs.count,
    totalAnalyses: totalAnalyses.count,
    costThisMonth: parseFloat(costResult.total ?? "0"),
    totalTokensIn: parseInt(String(costResult.totalTokensIn ?? "0")),
    totalTokensOut: parseInt(String(costResult.totalTokensOut ?? "0")),
  };
}

async function getTopUsers() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      name: users.name,
      email: users.email,
      count: count(conversations.id),
    })
    .from(users)
    .leftJoin(
      conversations,
      and(eq(conversations.userId, users.id), gte(conversations.startedAt, thirtyDaysAgo))
    )
    .groupBy(users.id, users.name, users.email)
    .orderBy(count(conversations.id))
    .limit(5);
  return rows.sort((a, b) => b.count - a.count).filter((r) => r.count > 0);
}

async function getTopSimulations() {
  const rows = await db
    .select({
      key: bots.key,
      title: bots.title,
      runs: count(conversations.id),
      uniqueUsers: countDistinct(conversations.userId),
    })
    .from(bots)
    .leftJoin(conversations, eq(conversations.botId, bots.id))
    .where(eq(bots.kind, "simulation"))
    .groupBy(bots.id, bots.key, bots.title)
    .orderBy(desc(count(conversations.id)))
    .limit(5);
  return rows.filter((r) => r.runs > 0);
}

async function getDailyCosts() {
  const days: { date: string; cost: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const [res] = await db
      .select({ total: sum(messages.cost) })
      .from(messages)
      .where(and(gte(messages.createdAt, d), lt(messages.createdAt, next)));

    days.push({
      date: d.toLocaleDateString("bg", { day: "numeric", month: "short" }),
      cost: parseFloat(res?.total ?? "0"),
    });
  }
  return days;
}

async function getDailyConversations() {
  const days: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const [res] = await db
      .select({ count: count() })
      .from(conversations)
      .where(and(gte(conversations.startedAt, d), lt(conversations.startedAt, next)));

    days.push({
      date: d.toLocaleDateString("bg", { day: "numeric", month: "short" }),
      count: res?.count ?? 0,
    });
  }
  return days;
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [stats, topUsers, topSimulations, dailyConvs, dailyCosts] = await Promise.all([
    getStats(),
    getTopUsers(),
    getTopSimulations(),
    getDailyConversations(),
    getDailyCosts(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="t-heading font-bold text-foreground">Дашборд</h1>
        <p className="t-body text-muted-foreground">Преглед на платформата</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Users (combined) */}
        <Link href="/admin/users" className="bg-white rounded-2xl border border-border p-5 hover:border-primary/50 hover:bg-primary/5 transition-colors block">
          <p className="t-small text-muted-foreground">Потребители</p>
          <p className="t-heading font-bold text-foreground mt-1">{stats.totalUsers}</p>
          <p className="t-small text-muted-foreground mt-0.5">
            {stats.activeUsers7d} активни (7д) · {stats.activeUsers30d} (30д)
          </p>
          <p className="t-small text-primary mt-1">Виж всички →</p>
        </Link>

        {/* Conversations */}
        <Link href="/admin/conversations" className="bg-white rounded-2xl border border-border p-5 hover:border-primary/50 hover:bg-primary/5 transition-colors block">
          <p className="t-small text-muted-foreground">Разговори</p>
          <p className="t-heading font-bold text-foreground mt-1">{stats.totalConversations}</p>
          <p className="t-small text-primary mt-1">Виж всички →</p>
        </Link>

        {/* Analyses */}
        <Link href="/admin/analytics" className="bg-white rounded-2xl border border-border p-5 hover:border-primary/50 hover:bg-primary/5 transition-colors block">
          <p className="t-small text-muted-foreground">Анализи</p>
          <p className="t-heading font-bold text-foreground mt-1">{stats.totalAnalyses}</p>
          <p className="t-small text-primary mt-1">Виж анализи →</p>
        </Link>
      </div>

      {/* Charts */}
      <AdminDashboardCharts dailyCosts={dailyCosts} dailyConvs={dailyConvs} />

      {/* Bottom row: top users + top simulations */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top users */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="t-subheading font-semibold">Топ активни потребители (30д)</h2>
            <Link href="/admin/users" className="t-small text-primary hover:underline">Виж всички →</Link>
          </div>
          <div className="space-y-2">
            {topUsers.map((u) => (
              <div key={u.email} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div>
                  <p className="t-body font-medium">{u.name ?? "—"}</p>
                  <p className="t-small text-muted-foreground">{u.email}</p>
                </div>
                <span className="t-body font-medium">{u.count} {u.count === 1 ? "разговор" : "разговора"}</span>
              </div>
            ))}
            {topUsers.length === 0 && (
              <p className="t-body text-muted-foreground text-center py-4">Няма данни.</p>
            )}
          </div>
        </div>

        {/* Top simulations */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="t-subheading font-semibold">Топ симулации</h2>
            <Link href="/admin/simulations" className="t-small text-primary hover:underline">Виж всички →</Link>
          </div>
          <div className="space-y-2">
            {topSimulations.map((s) => (
              <Link
                key={s.key}
                href={`/admin/simulations/${s.key}`}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 hover:text-primary transition-colors"
              >
                <div>
                  <p className="t-body font-medium">{s.title}</p>
                  <p className="t-small text-muted-foreground">{s.uniqueUsers} {s.uniqueUsers === 1 ? "потребител" : "потребители"}</p>
                </div>
                <span className="t-body font-medium">{s.runs} {s.runs === 1 ? "симулация" : "симулации"}</span>
              </Link>
            ))}
            {topSimulations.length === 0 && (
              <p className="t-body text-muted-foreground text-center py-4">Няма данни.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
