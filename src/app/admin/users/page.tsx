import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { users, conversations } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("bg", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminUsersPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
      convCount: count(conversations.id),
    })
    .from(users)
    .leftJoin(conversations, eq(conversations.userId, users.id))
    .groupBy(users.id)
    .orderBy(users.createdAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-heading font-bold">Потребители</h1>
        <p className="t-body text-muted-foreground">{rows.length} общо · {rows.filter(r => r.role !== "user").length} с роля</p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Потребител", "Роля", "Разговори", "Последна активност", "Регистрация", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 t-small font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.name ?? "—"}</div>
                  <div className="t-small text-muted-foreground">{row.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={cn(
                    row.role === "it" ? "bg-purple-100 text-purple-700" :
                    row.role === "admin" ? "bg-blue-100 text-blue-700" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {row.role}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-medium">{row.convCount}</td>
                <td className="px-4 py-3 t-small text-muted-foreground">{formatDate(row.lastActiveAt)}</td>
                <td className="px-4 py-3 t-small text-muted-foreground">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${row.id}`}
                    className="text-primary hover:underline t-small"
                  >
                    Детайли →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center t-body text-muted-foreground py-8">Няма потребители.</p>
        )}
      </div>
    </div>
  );
}
