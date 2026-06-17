import { requireIT } from "@/lib/auth-helpers";
import db from "@/db";
import { auditLog, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

function formatDate(d: Date) {
  return new Date(d).toLocaleString("bg", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function AdminAuditPage() {
  await requireIT();

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      target: auditLog.target,
      meta: auditLog.meta,
      createdAt: auditLog.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-heading font-bold">Одит лог</h1>
        <p className="t-body text-muted-foreground">Последните {rows.length} действия</p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Дата", "Извършен от", "Действие", "Обект", "Метаданни"].map((h) => (
                <th key={h} className="text-left px-4 py-3 t-small font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 t-small text-muted-foreground whitespace-nowrap">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="t-body">{row.actorName ?? "—"}</div>
                  <div className="t-small text-muted-foreground">{row.actorEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded t-small">{row.action}</code>
                </td>
                <td className="px-4 py-3 t-small text-muted-foreground">{row.target ?? "—"}</td>
                <td className="px-4 py-3 t-small text-muted-foreground max-w-xs truncate">
                  {row.meta ? JSON.stringify(row.meta) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center t-body text-muted-foreground py-8">Няма записи.</p>
        )}
      </div>
    </div>
  );
}
