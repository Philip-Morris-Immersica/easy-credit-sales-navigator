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
  summary?: { newUsers: number; conversations: number; messages: number; totalCost: number };
  activeUsers?: Array<{ name: string; email: string; conversations: number; messages: number; cost: number }>;
  languageBreakdown?: Array<{ language: string; conversations: number; messages: number; cost: number }>;
  modelBreakdown?: Array<{ model: string; messages: number; tokensIn: number; tokensOut: number; cost: number }>;
  transcripts?: Array<{ conversationId: string; userEmail: string; botTitle: string; startedAt: string; messages: Array<{ role: string; content: string }> }>;
}

const INCLUDES = [
  { key: "summary", label: "Обобщение на периода", desc: "Нови потребители, разговори, токени, разход" },
  { key: "activeUsers", label: "Активни потребители в периода", desc: "Всички с активност, сортирани" },
  { key: "languageBreakdown", label: "Разбивка по език", desc: "Разговори, съобщения и разход по език" },
  { key: "modelBreakdown", label: "Разбивка по модел", desc: "Съобщения, токени и разход по AI модел" },
  { key: "transcripts", label: "Транскрипти на чатове", desc: "Пълно съдържание — увеличава файла значително", heavy: true },
  { key: "anonymize", label: "Анонимизиране", desc: "Замества имена/имейли с User #ID в експорта" },
] as const;

export function ReportsClient() {
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [includes, setIncludes] = useState<Set<string>>(
    new Set(["summary", "activeUsers", "languageBreakdown", "modelBreakdown"])
  );
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

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
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, includes: Array.from(includes) }),
      });
      const data = await res.json();
      setReportData(data);
    } catch (e) {
      alert("Грешка: " + e);
    } finally {
      setLoading(false);
    }
  }

  async function exportXLSX() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, includes: Array.from(includes) }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${from}-${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Грешка при експорт: " + e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="t-heading font-bold">Репорти</h1>
        <p className="t-body text-muted-foreground">Генерирай и експортирай данни</p>
      </div>

      {/* Period */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">1. Период</h2>
        <div className="flex gap-2 flex-wrap">
          {(["today", "7d", "30d", "all"] as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "outline"}
              onClick={() => setPeriodPreset(p)}
            >
              {p === "today" ? "Днес" : p === "7d" ? "7д" : p === "30d" ? "30д" : "Всичко"}
            </Button>
          ))}
        </div>
        <div className="flex gap-4 items-center">
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
      <div className="flex gap-3">
        <Button onClick={generateReport} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
          Генерирай репорт
        </Button>
        <Button onClick={exportXLSX} disabled={loading} variant="outline" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Експорт XLSX
        </Button>
      </div>

      {/* Report visualization */}
      {reportData && (
        <div className="space-y-6">
          {/* Summary */}
          {reportData.summary && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="t-subheading font-semibold mb-4">Обобщение</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Нови потребители", value: reportData.summary.newUsers },
                  { label: "Разговори", value: reportData.summary.conversations },
                  { label: "Съобщения", value: reportData.summary.messages },
                  { label: "Разход", value: `$${reportData.summary.totalCost.toFixed(4)}` },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="t-heading font-bold">{s.value}</div>
                    <div className="t-small text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Language breakdown chart */}
          {reportData.languageBreakdown && reportData.languageBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="t-subheading font-semibold mb-4">Разбивка по език</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={reportData.languageBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="language" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="conversations" fill="#D6071A" name="Разговори" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Model breakdown */}
          {reportData.modelBreakdown && reportData.modelBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="t-subheading font-semibold mb-4">Разбивка по модел</h2>
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {["Модел", "Съобщения", "Токени вход", "Токени изход", "Разход"].map((h) => (
                      <th key={h} className="text-left py-2 t-small font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportData.modelBreakdown.map((m) => (
                    <tr key={m.model}>
                      <td className="py-2 font-medium">{m.model}</td>
                      <td className="py-2">{m.messages}</td>
                      <td className="py-2">{m.tokensIn}</td>
                      <td className="py-2">{m.tokensOut}</td>
                      <td className="py-2">${m.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Active users */}
          {reportData.activeUsers && reportData.activeUsers.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="t-subheading font-semibold mb-4">Активни потребители</h2>
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {["Потребител", "Разговори", "Съобщения", "Разход"].map((h) => (
                      <th key={h} className="text-left py-2 t-small font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportData.activeUsers.map((u) => (
                    <tr key={u.email}>
                      <td className="py-2">
                        <div className="font-medium">{u.name}</div>
                        <div className="t-small text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-2">{u.conversations}</td>
                      <td className="py-2">{u.messages}</td>
                      <td className="py-2">${u.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
