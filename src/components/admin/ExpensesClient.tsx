"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/admin/DateField";
import { todayIso, daysAgoIso, LAUNCH_ISO } from "@/lib/date-range";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

type Period = "today" | "7d" | "30d" | "all";

interface ModelRow {
  model: string;
  messages: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

interface UserRow {
  name: string;
  email: string;
  conversations: number;
  cost: number;
}

interface DailyCostRow {
  date: string;
  cost: number;
  tokens: number;
}

interface ExpensesData {
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalMessages: number;
  modelBreakdown: ModelRow[];
  userBreakdown: UserRow[];
  dailyCosts: DailyCostRow[];
}

export function ExpensesClient() {
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(() => daysAgoIso(30));
  const [to, setTo] = useState(() => todayIso());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExpensesData | null>(null);

  function setPeriodPreset(p: Period) {
    setPeriod(p);
    if (p === "today") setFrom(todayIso());
    else if (p === "7d") setFrom(daysAgoIso(7));
    else if (p === "30d") setFrom(daysAgoIso(30));
    else setFrom(LAUNCH_ISO);
    setTo(todayIso());
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/expenses?from=${from}&to=${to}`);
      const json = await res.json();
      setData(json);
    } catch {
      alert("Грешка при зареждане");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="t-heading font-bold">Разходи</h1>
        <p className="t-body text-muted-foreground">Детайлна разбивка на разходите по модел, потребител и дата</p>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Период</h2>
        <div className="flex gap-2 flex-wrap">
          {(["today", "7d", "30d", "all"] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriodPreset(p)}>
              {p === "today" ? "Днес" : p === "7d" ? "7 дни" : p === "30d" ? "30 дни" : "Всичко"}
            </Button>
          ))}
        </div>
        <div className="flex gap-4 items-end flex-wrap">
          <div className="space-y-1">
            <p className="t-small text-muted-foreground">От</p>
            <DateField value={from} onChange={setFrom} />
          </div>
          <div className="space-y-1">
            <p className="t-small text-muted-foreground">До</p>
            <DateField value={to} onChange={setTo} />
          </div>
          <Button onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Зареди
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Общ разход (USD)", value: `$${data.totalCost.toFixed(4)} USD` },
              { label: "Съобщения", value: data.totalMessages.toLocaleString() },
              { label: "Токени вход", value: `${(data.totalTokensIn / 1000).toFixed(1)}K` },
              { label: "Токени изход", value: `${(data.totalTokensOut / 1000).toFixed(1)}K` },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-border p-5">
                <p className="t-small text-muted-foreground">{s.label}</p>
                <p className="t-heading font-bold text-foreground mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Daily cost chart */}
          {data.dailyCosts.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="t-subheading font-semibold mb-4">Разходи по ден</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.dailyCosts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(4)}`} />
                  <Tooltip formatter={(v) => [`$${typeof v === "number" ? v.toFixed(4) : v} USD`, "Разход"]} />
                  <Line type="monotone" dataKey="cost" name="Разход" stroke="#D6071A" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Model breakdown chart */}
            {data.modelBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-6">
                <h2 className="t-subheading font-semibold mb-4">Разбивка по модел</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.modelBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="model" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(4)}`} />
                    <Tooltip formatter={(v) => [`$${typeof v === "number" ? v.toFixed(4) : v} USD`, "Разход"]} />
                    <Bar dataKey="cost" name="Разход" fill="#D6071A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <table className="w-full text-xs mt-3 border-t border-border">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1.5">Модел</th>
                      <th className="text-right py-1.5">Съобщения</th>
                      <th className="text-right py-1.5">Токени (вх)</th>
                      <th className="text-right py-1.5">Токени (изх)</th>
                      <th className="text-right py-1.5">Разход (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.modelBreakdown.map((m) => (
                      <tr key={m.model} className="border-t border-border/40">
                        <td className="py-1 font-mono">{m.model}</td>
                        <td className="py-1 text-right">{m.messages}</td>
                        <td className="py-1 text-right">{(m.tokensIn / 1000).toFixed(1)}K</td>
                        <td className="py-1 text-right">{(m.tokensOut / 1000).toFixed(1)}K</td>
                        <td className="py-1 text-right font-medium">${m.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* User breakdown */}
            {data.userBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-6">
                <h2 className="t-subheading font-semibold mb-4">Разбивка по потребител</h2>
                <div className="overflow-auto max-h-[380px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="text-left py-1.5">Потребител</th>
                        <th className="text-right py-1.5">Разговори</th>
                        <th className="text-right py-1.5">Разход (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.userBreakdown.map((u) => (
                        <tr key={u.email} className="border-t border-border/40">
                          <td className="py-1.5">
                            <div className="font-medium">{u.name || "—"}</div>
                            <div className="text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="py-1.5 text-right">{u.conversations}</td>
                          <td className="py-1.5 text-right font-medium">${u.cost.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <p className="t-body text-muted-foreground">Изберете период и натиснете <strong>Зареди</strong></p>
        </div>
      )}
    </div>
  );
}
