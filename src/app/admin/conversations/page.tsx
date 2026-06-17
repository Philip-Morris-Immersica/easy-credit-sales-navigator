import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { conversations, users, bots, analyses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatDate(d: Date) {
  return new Date(d).toLocaleString("bg", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function AdminConversationsPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      kind: conversations.kind,
      status: conversations.status,
      language: conversations.language,
      startedAt: conversations.startedAt,
      lastActivityAt: conversations.lastActivityAt,
      userName: users.name,
      userEmail: users.email,
      botTitle: bots.title,
      overallScore: analyses.overallScore,
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.userId, users.id))
    .leftJoin(bots, eq(conversations.botId, bots.id))
    .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
    .orderBy(desc(conversations.lastActivityAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-heading font-bold">Разговори</h1>
        <p className="t-body text-muted-foreground">{rows.length} разговора общо</p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Потребител", "Бот", "Език", "Съобщения", "Стартиран", "Последна активност", "Оценка", "Преглед"].map((h) => (
                <th key={h} className="text-left px-4 py-3 t-small font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.userName ?? "—"}</div>
                  <div className="t-small text-muted-foreground">{row.userEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{row.botTitle ?? "—"}</div>
                  <Badge variant="secondary" className="text-xs mt-0.5">
                    {row.kind === "simulation" ? "Симулация" : "Консултант"}
                  </Badge>
                </td>
                <td className="px-4 py-3 uppercase t-small">{row.language}</td>
                <td className="px-4 py-3">
                  <Badge className={cn(
                    row.status === "completed" ? "bg-green-100 text-green-700" :
                    row.status === "active" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                  )}>
                    {row.status === "completed" ? "Завършен" : row.status === "active" ? "Активен" : "Изоставен"}
                  </Badge>
                </td>
                <td className="px-4 py-3 t-small text-muted-foreground">{formatDate(row.startedAt)}</td>
                <td className="px-4 py-3 t-small text-muted-foreground">{formatDate(row.lastActivityAt)}</td>
                <td className="px-4 py-3 font-medium">
                  {row.overallScore != null ? (
                    <span className={cn(
                      row.overallScore >= 8 ? "text-green-600" :
                      row.overallScore >= 6 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {row.overallScore.toFixed(1)}
                    </span>
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
        {rows.length === 0 && (
          <p className="text-center t-body text-muted-foreground py-8">Няма разговори.</p>
        )}
      </div>
    </div>
  );
}
