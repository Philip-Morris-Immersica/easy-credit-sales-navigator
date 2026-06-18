"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Download, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

type Period = "today" | "7d" | "30d" | "all";

interface ReportData {
  error?: string;
  summary?: {
    newUsers: number;
    conversations: number;
    messages: number;
    analyses: number;
    totalCost: number;
  };
  activeUsers?: Array<{
    name: string; email: string; conversations: number;
    messages: number; tokensIn: number; tokensOut: number; cost: number;
  }>;
  analyses?: Array<{
    user: string; email: string; bot: string; date: string;
    overallScore: number | null; summary: string; strengths: string; improvements: string;
  }>;
}

const INCLUDES = [
  {
    key: "summary",
    label: "Обобщение на периода",
    desc: "Нови потребители, разговори, съобщения, анализи, разход",
  },
  {
    key: "activeUsers",
    label: "Потребители с разходи",
    desc: "Разговори, съобщения, токени и разход по потребител",
  },
  {
    key: "analyses",
    label: "Анализи",
    desc: "Оценки, обобщения, силни страни и области за подобрение",
  },
  {
    key: "transcripts",
    label: "Транскрипти на чатове",
    desc: "Пълен диалог на всеки разговор — увеличава файла значително",
    heavy: true,
  },
  {
    key: "anonymize",
    label: "Анонимизиране",
    desc: "Замества имена/имейли с User #ID",
  },
] as const;

export function ReportsClient() {
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [includes, setIncludes] = useState<Set<string>>(
    new Set(["summary", "activeUsers", "analyses"])
  );
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleInclude(key: string) {
    setIncludes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function setPeriodPreset(p: Period) {
    setPeriod(p);
    const now = new Date();
    const fromDate = new Date();
    if (p === "today") fromDate.setHours(0, 0, 0, 0);
    else if (p === "7d") fromDate.setDate(now.getDate() - 7);
    else if (p === "30d") fromDate.setDate(now.getDate() - 30);
    else fromDate.setFullYear(2020, 0, 1);
    setFrom(fromDate.toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));
  }

  async function generateReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, includes: Array.from(includes) }),
      });
      const data: ReportData = await res.json();
      if (data.error) setError(data.error);
      else setReportData(data);
    } catch (e) {
      setError("Грешка при генериране: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  async function exportXLSX() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, includes: Array.from(includes) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Неизвестна грешка" }));
        setError(err.error ?? "Грешка при експорт");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${from}-${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Грешка при експорт: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="t-heading font-bold">Репорти</h1>
        <p className="t-body text-muted-foreground">Генерирай и свали Excel доклад за ръководството</p>
      </div>

      {/* Period */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">1. Период</h2>
        <div className="flex gap-2 flex-wrap">
          {(["today", "7d", "30d", "all"] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriodPreset(p)}>
              {p === "today" ? "Днес" : p === "7d" ? "7д" : p === "30d" ? "30д" : "Всичко"}
            </Button>
          ))}
        </div>
        <div className="flex gap-4 items-center flex-wrap">
          <div className="space-y-1">
            <Label className="t-small">От</Label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-border rounded-lg px-3 py-1.5 t-small" />
          </div>
          <div className="space-y-1">
            <Label className="t-small">До</Label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-border rounded-lg px-3 py-1.5 t-small" />
          </div>
        </div>
      </div>

      {/* What to include */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-3">
        <h2 className="t-subheading font-semibold">2. Какво да включи</h2>
        {INCLUDES.map((item) => (
          <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={includes.has(item.key)}
              onChange={() => toggleInclude(item.key)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <div>
              <span className="t-body font-medium group-hover:text-primary">{item.label}</span>
              {"heavy" in item && item.heavy && (
                <span className="ml-2 t-small text-orange-500">⚠ Тежко</span>
              )}
              <p className="t-small text-muted-foreground">{item.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={generateReport} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
          Преглед в браузъра
        </Button>
        <Button onClick={exportXLSX} disabled={loading} variant="outline" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Свали Excel (.xlsx)
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-destructive t-body">
          {error}
        </div>
      )}

      {/* Preview */}
      {reportData && !reportData.error && (
        <div className="space-y-6">

          {/* Summary */}
          {reportData.summary && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="t-subheading font-semibold mb-4">Обобщение</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "Нови потребители", value: reportData.summary.newUsers },
                  { label: "Разговори", value: reportData.summary.conversations },
                  { label: "Съобщения", value: reportData.summary.messages },
                  { label: "Анализи", value: reportData.summary.analyses },
                  { label: "Разход (USD)", value: `$${reportData.summary.totalCost.toFixed(6)}` },
                ].map((s) => (
                  <div key={s.label} className="text-center bg-muted/20 rounded-xl p-3">
                    <div className="t-heading font-bold">{s.value}</div>
                    <div className="t-small text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Users + costs chart */}
          {reportData.activeUsers && reportData.activeUsers.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="t-subheading font-semibold mb-4">Потребители с разходи</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={reportData.activeUsers.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toFixed(4)}`} />
                  <Tooltip formatter={(v) => [`$${typeof v === "number" ? v.toFixed(6) : v}`, "Разход"]} />
                  <Bar dataKey="cost" fill="#D6071A" name="Разход" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-4 border-t border-border">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1.5">Потребител</th>
                    <th className="text-right py-1.5">Разговори</th>
                    <th className="text-right py-1.5">Съобщения</th>
                    <th className="text-right py-1.5">Токени</th>
                    <th className="text-right py-1.5">Разход</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.activeUsers.map((u) => (
                    <tr key={u.email} className="border-t border-border/40">
                      <td className="py-1.5">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-1.5 text-right">{u.conversations}</td>
                      <td className="py-1.5 text-right">{u.messages}</td>
                      <td className="py-1.5 text-right">{((u.tokensIn + u.tokensOut) / 1000).toFixed(1)}K</td>
                      <td className="py-1.5 text-right font-medium">${u.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Analyses preview */}
          {reportData.analyses && reportData.analyses.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="t-subheading font-semibold mb-4">
                Анализи ({reportData.analyses.length} бр.)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border">
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1.5 pr-3">Потребител</th>
                      <th className="text-left py-1.5 pr-3">Бот</th>
                      <th className="text-left py-1.5 pr-3">Дата</th>
                      <th className="text-right py-1.5 pr-3">Оценка</th>
                      <th className="text-left py-1.5">Обобщение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.analyses.map((a, i) => (
                      <tr key={i} className="border-t border-border/40 align-top">
                        <td className="py-1.5 pr-3">
                          <div className="font-medium">{a.user}</div>
                          <div className="text-muted-foreground">{a.email}</div>
                        </td>
                        <td className="py-1.5 pr-3">{a.bot}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{a.date}</td>
                        <td className="py-1.5 pr-3 text-right font-bold">
                          {a.overallScore != null ? (
                            <span className={
                              a.overallScore >= 8 ? "text-green-600" :
                              a.overallScore >= 6 ? "text-yellow-600" : "text-red-600"
                            }>
                              {a.overallScore.toFixed(1)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-1.5 text-muted-foreground max-w-xs truncate">{a.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
