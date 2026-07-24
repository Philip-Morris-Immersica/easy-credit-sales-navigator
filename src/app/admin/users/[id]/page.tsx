import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { users, conversations, messages, analyses, bots } from "@/db/schema";
import { eq, desc, count, sum, and, gte } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { UserActiveToggle } from "@/components/admin/UserActiveToggle";
import { UserNameEditor } from "@/components/admin/UserNameEditor";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("bg", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireAdmin();
  const { id } = await params;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .then((r) => r[0]);

  if (!user) notFound();

  // All conversations with message count and analysis
  const convRows = await db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      status: conversations.status,
      startedAt: conversations.startedAt,
      lastActivityAt: conversations.lastActivityAt,
      botTitle: bots.title,
      overallScore: analyses.overallScore,
      summary: analyses.summary,
      msgCount: count(messages.id),
    })
    .from(conversations)
    .leftJoin(bots, eq(conversations.botId, bots.id))
    .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, id))
    .groupBy(
      conversations.id, conversations.kind, conversations.status,
      conversations.startedAt, conversations.lastActivityAt,
      bots.title, analyses.overallScore, analyses.summary
    )
    .orderBy(desc(conversations.lastActivityAt));

  // Aggregate stats
  const totalMsgs = convRows.reduce((s, r) => s + r.msgCount, 0);
  const simConvs = convRows.filter((r) => r.kind === "simulation");
  const consultConvs = convRows.filter((r) => r.kind === "consultant");
  const analyzedConvs = convRows.filter((r) => r.overallScore != null);
  const avgScore = analyzedConvs.length > 0
    ? (analyzedConvs.reduce((s, r) => s + (r.overallScore ?? 0), 0) / analyzedConvs.length).toFixed(1)
    : null;

  // Total cost for this user
  const [costRes] = await db
    .select({ total: sum(messages.cost), tokensIn: sum(messages.tokensIn), tokensOut: sum(messages.tokensOut) })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, id));

  const totalCost = parseFloat(String(costRes?.total ?? "0"));
  const totalTokens = parseInt(String(costRes?.tokensIn ?? "0")) + parseInt(String(costRes?.tokensOut ?? "0"));

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="t-heading font-bold">{user.name ?? "—"}</h1>
          <p className="t-body text-muted-foreground">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className={cn(
            user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {user.active ? "Активен" : "Деактивиран"}
          </Badge>
          <Badge className={cn(
            user.role === "it" ? "bg-purple-100 text-purple-700" :
            user.role === "admin" ? "bg-blue-100 text-blue-700" :
            "bg-muted text-muted-foreground"
          )}>
            {user.role}
          </Badge>
          <UserNameEditor userId={user.id} currentName={user.name} />
          <UserActiveToggle userId={user.id} active={user.active} isSelf={user.id === viewer.id} />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Общо разговори", value: convRows.length },
          { label: "Симулации", value: simConvs.length },
          { label: "С анализ", value: analyzedConvs.length },
          { label: "Средна оценка", value: avgScore ? `${avgScore}/10` : "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4">
            <p className="t-small text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Консултации", value: consultConvs.length },
          { label: "Общо реплики", value: totalMsgs },
          { label: "Общо токени", value: `${(totalTokens / 1000).toFixed(1)}K` },
          { label: "Общ разход (USD)", value: `$${totalCost.toFixed(4)} USD` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4">
            <p className="t-small text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* User info */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="t-subheading font-semibold mb-4">Информация</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Регистрация:</span>{" "}
            <span className="font-medium">{formatDate(user.createdAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Последна активност:</span>{" "}
            <span className="font-medium">{formatDate(user.lastActiveAt)}</span>
          </div>
        </div>
      </div>

      {/* Conversations table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="t-subheading font-semibold">Разговори ({convRows.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Бот / Тип", "Статус", "Реплики", "Оценка", "Дата", "Преглед"].map((h) => (
                <th key={h} className="text-left px-4 py-3 t-small font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {convRows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.botTitle ?? "—"}</div>
                  <Badge variant="secondary" className="text-xs mt-0.5">
                    {row.kind === "simulation" ? "Симулация" : "Консултант"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge className={cn(
                    row.status === "completed" ? "bg-green-100 text-green-700" :
                    row.status === "active" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                  )}>
                    {row.status === "completed" ? "Завършен" : row.status === "active" ? "Активен" : "Изоставен"}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-medium">{row.msgCount}</td>
                <td className="px-4 py-3">
                  {row.overallScore != null ? (
                    <span className={cn(
                      "font-semibold",
                      row.overallScore >= 8 ? "text-green-600" :
                      row.overallScore >= 6 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {row.overallScore.toFixed(1)}/10
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 t-small text-muted-foreground">{formatDate(row.startedAt)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/me/conversations/${row.id}?from=${encodeURIComponent(`/admin/users/${id}`)}`}
                    className="text-primary hover:underline t-small"
                  >
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
