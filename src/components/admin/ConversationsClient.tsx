"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2, Loader2 } from "lucide-react";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("bg", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export interface ConversationRow {
  id: string;
  title: string | null;
  kind: "simulation" | "consultant";
  status: "active" | "completed" | "abandoned";
  startedAt: Date;
  lastActivityAt: Date;
  userName: string | null;
  userEmail: string | null;
  botTitle: string | null;
  overallScore: number | null;
  msgCount: number;
}

interface Props {
  rows: ConversationRow[];
  canDelete: boolean;
  stats: {
    totalConvs: number;
    uniqueUsers: number;
    avgMessages: string;
    withAnalysis: number;
    analysisPercent: number;
  };
}

export function ConversationsClient({ rows: initialRows, canDelete, stats }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setConfirmId(null);
      } else {
        alert("Грешка при изтриване");
      }
    } catch {
      alert("Грешка при изтриване");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-heading font-bold">Разговори</h1>
        <p className="t-body text-muted-foreground">Всички разговори на платформата</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Общо разговори", value: stats.totalConvs },
          { label: "Уникални потребители", value: stats.uniqueUsers },
          { label: "Средно реплики", value: stats.avgMessages },
          { label: "С анализ", value: `${stats.withAnalysis} (${stats.analysisPercent}%)` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4">
            <p className="t-small text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {[
                "Потребител", "Бот", "Статус", "Реплики",
                "Стартиран", "Последна активност", "Оценка", "Преглед",
                ...(canDelete ? [""] : []),
              ].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 t-small font-semibold text-muted-foreground">{h}</th>
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
                  <Link
                    href={`/me/conversations/${row.id}?from=${encodeURIComponent("/admin/conversations")}`}
                    className="text-primary hover:underline t-small"
                  >
                    Виж →
                  </Link>
                </td>
                {canDelete && (
                  <td className="px-4 py-3">
                    {confirmId === row.id ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={deletingId === row.id}
                          onClick={() => handleDelete(row.id)}
                        >
                          {deletingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Изтрий"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setConfirmId(null)}
                        >
                          Отказ
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(row.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Изтрий разговор"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                )}
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
