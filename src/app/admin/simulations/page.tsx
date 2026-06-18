import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { bots, conversations, analyses } from "@/db/schema";
import { eq, count, countDistinct, avg, desc } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

async function getSimulations() {
  const rows = await db
    .select({
      key: bots.key,
      title: bots.title,
      direction: bots.direction,
      enabled: bots.enabled,
      runs: count(conversations.id),
      uniqueUsers: countDistinct(conversations.userId),
      avgScore: avg(analyses.overallScore),
    })
    .from(bots)
    .leftJoin(conversations, eq(conversations.botId, bots.id))
    .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
    .where(eq(bots.kind, "simulation"))
    .groupBy(bots.id, bots.key, bots.title, bots.direction, bots.enabled)
    .orderBy(desc(count(conversations.id)));

  return rows.map((r) => ({
    key: r.key,
    title: r.title,
    direction: r.direction,
    enabled: r.enabled,
    runs: r.runs,
    uniqueUsers: r.uniqueUsers,
    avgScore: r.avgScore != null ? parseFloat(String(r.avgScore)) : null,
  }));
}

export default async function AdminSimulationsPage() {
  await requireAdmin();
  const sims = await getSimulations();

  const totalRuns = sims.reduce((s, r) => s + r.runs, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-heading font-bold">Симулации</h1>
        <p className="t-body text-muted-foreground">Статистика по симулации и преминали потребители</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="t-small text-muted-foreground">Симулации</p>
          <p className="text-xl font-bold text-foreground mt-1">{sims.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="t-small text-muted-foreground">Общо проведени</p>
          <p className="text-xl font-bold text-foreground mt-1">{totalRuns}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="t-small text-muted-foreground">Активни симулации</p>
          <p className="text-xl font-bold text-foreground mt-1">{sims.filter((s) => s.enabled).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Симулация", "Проведени", "Потребители", "Ср. оценка", ""].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 t-small font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sims.map((s) => (
              <tr key={s.key} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.title}</span>
                    {!s.enabled && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">Изключена</Badge>
                    )}
                    {s.direction && (
                      <Badge variant="secondary" className="text-xs">
                        {s.direction === "call" ? "Обаждане" : "Среща"}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{s.runs}</td>
                <td className="px-4 py-3">{s.uniqueUsers}</td>
                <td className="px-4 py-3 font-medium">
                  {s.avgScore != null ? s.avgScore.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/simulations/${s.key}`} className="text-primary hover:underline t-small">
                    Детайли →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sims.length === 0 && (
          <p className="text-center t-body text-muted-foreground py-8">Няма симулации.</p>
        )}
      </div>
    </div>
  );
}
