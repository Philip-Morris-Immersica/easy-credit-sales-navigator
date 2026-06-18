import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { bots, conversations, analyses, messages, users } from "@/db/schema";
import { and, eq, count, desc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("bg", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function scoreColor(score: number) {
  return score >= 8 ? "text-green-600" : score >= 6 ? "text-yellow-600" : "text-red-600";
}

export default async function AdminSimulationDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requireAdmin();
  const { key } = await params;

  const [bot] = await db
    .select()
    .from(bots)
    .where(and(eq(bots.key, key), eq(bots.kind, "simulation")))
    .limit(1);

  if (!bot) notFound();

  const convRows = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      startedAt: conversations.startedAt,
      lastActivityAt: conversations.lastActivityAt,
      userId: conversations.userId,
      userName: users.name,
      userEmail: users.email,
      overallScore: analyses.overallScore,
      msgCount: count(messages.id),
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.userId, users.id))
    .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.botId, bot.id))
    .groupBy(
      conversations.id, conversations.status, conversations.startedAt,
      conversations.lastActivityAt, conversations.userId,
      users.name, users.email, analyses.overallScore
    )
    .orderBy(desc(conversations.lastActivityAt));

  // Per-user aggregation
  const userMap = new Map<
    string,
    { name: string | null; email: string | null; runs: number; scores: number[]; lastActivity: Date }
  >();
  for (const r of convRows) {
    const k = r.userId;
    const existing = userMap.get(k);
    if (existing) {
      existing.runs += 1;
      if (r.overallScore != null) existing.scores.push(r.overallScore);
      if (new Date(r.lastActivityAt) > existing.lastActivity) existing.lastActivity = new Date(r.lastActivityAt);
    } else {
      userMap.set(k, {
        name: r.userName,
        email: r.userEmail,
        runs: 1,
        scores: r.overallScore != null ? [r.overallScore] : [],
        lastActivity: new Date(r.lastActivityAt),
      });
    }
  }
  const userBreakdown = Array.from(userMap.values()).sort((a, b) => b.runs - a.runs);

  const totalRuns = convRows.length;
  const uniqueUsers = userMap.size;
  const completed = convRows.filter((r) => r.status === "completed").length;
  const scored = convRows.filter((r) => r.overallScore != null).map((r) => r.overallScore as number);
  const avgScore = scored.length > 0 ? scored.reduce((s, v) => s + v, 0) / scored.length : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/simulations"
          className="inline-flex items-center gap-1.5 t-small text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Към симулации
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="t-heading font-bold">{bot.title}</h1>
          {!bot.enabled && (
            <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">Изключена</Badge>
          )}
          {bot.direction && (
            <Badge variant="secondary" className="text-xs">
              {bot.direction === "call" ? "Обаждане" : "Среща"}
            </Badge>
          )}
        </div>
        <p className="t-body text-muted-foreground">Статистика по симулацията</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Проведени", value: totalRuns },
          { label: "Уникални потребители", value: uniqueUsers },
          { label: "Завършени", value: completed },
          { label: "Ср. оценка", value: avgScore != null ? avgScore.toFixed(1) : "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4">
            <p className="t-small text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Users who went through */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="t-subheading font-semibold">Преминали потребители</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Потребител", "Проведени", "Ср. оценка", "Последна активност"].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 t-small font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {userBreakdown.map((u) => {
              const uAvg = u.scores.length > 0 ? u.scores.reduce((s, v) => s + v, 0) / u.scores.length : null;
              return (
                <tr key={u.email ?? u.name ?? Math.random()} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name ?? "—"}</div>
                    <div className="t-small text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{u.runs}</td>
                  <td className="px-4 py-3 font-medium">
                    {uAvg != null ? <span className={scoreColor(uAvg)}>{uAvg.toFixed(1)}</span> : "—"}
                  </td>
                  <td className="px-4 py-3 t-small text-muted-foreground">{formatDate(u.lastActivity)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {userBreakdown.length === 0 && (
          <p className="text-center t-body text-muted-foreground py-8">Все още няма проведени симулации.</p>
        )}
      </div>

      {/* All conversations for this simulation */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="t-subheading font-semibold">Разговори</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Потребител", "Статус", "Реплики", "Стартиран", "Оценка", "Преглед"].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 t-small font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {convRows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.userName ?? "—"}</div>
                  <div className="t-small text-muted-foreground">{row.userEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={cn(
                    row.status === "completed" ? "bg-green-100 text-green-700" :
                    row.status === "active" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                  )}>
                    {row.status === "completed" ? "Завършен" : row.status === "active" ? "Активен" : "Изоставен"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center font-medium">{row.msgCount}</td>
                <td className="px-4 py-3 t-small text-muted-foreground">{formatDate(row.startedAt)}</td>
                <td className="px-4 py-3 font-medium">
                  {row.overallScore != null ? (
                    <span className={scoreColor(row.overallScore)}>{row.overallScore.toFixed(1)}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/me/conversations/${row.id}`} className="text-primary hover:underline t-small">
                    Виж →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {convRows.length === 0 && (
          <p className="text-center t-body text-muted-foreground py-8">Няма разговори.</p>
        )}
      </div>
    </div>
  );
}
