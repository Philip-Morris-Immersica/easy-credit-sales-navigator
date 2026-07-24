"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/admin/DateField";
import { todayIso, daysAgoIso, LAUNCH_ISO } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

type Period = "7d" | "30d" | "all";

interface AnalysisRow {
  id: string;
  conversationId: string;
  overallScore: number | null;
  summary: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  botTitle: string | null;
  userId: string | null;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

interface SummaryResult {
  summary: string;
  stats?: {
    total: number;
    avgScore: number;
    topStrengths: string[];
    topImprovements: string[];
  };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("bg", { day: "numeric", month: "short", year: "numeric" });
}

export function AnalyticsClient() {
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(() => daysAgoIso(30));
  const [to, setTo] = useState(() => todayIso());

  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data: UserOption[]) => setAllUsers(data))
      .catch(() => {});
  }, []);

  function setPeriodPreset(p: Period) {
    setPeriod(p);
    if (p === "7d") setFrom(daysAgoIso(7));
    else if (p === "30d") setFrom(daysAgoIso(30));
    else setFrom(LAUNCH_ISO);
    setTo(todayIso());
  }

  function toggleUser(id: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function loadAnalyses() {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (selectedUsers.size > 0) {
        Array.from(selectedUsers).forEach((id) => params.append("userId", id));
      }
      const res = await fetch(`/api/admin/analytics?${params}`);
      const data = await res.json();
      setAnalyses(data.analyses ?? []);
    } catch {
      setAnalyses([]);
    } finally {
      setLoadingList(false);
    }
  }

  async function generateSummary() {
    setSummaryLoading(true);
    setSummaryResult(null);
    setSummaryError(null);
    try {
      const res = await fetch("/api/admin/analytics-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          userIds: selectedUsers.size > 0 ? Array.from(selectedUsers) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setSummaryError(data.error);
      else setSummaryResult(data);
    } catch (e) {
      setSummaryError("Грешка: " + String(e));
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="t-heading font-bold">Анализи</h1>
        <p className="t-body text-muted-foreground">Преглед на AI анализите и обобщения за екипа</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Филтри</h2>
        <div className="flex gap-2 flex-wrap">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriodPreset(p)}>
              {p === "7d" ? "7 дни" : p === "30d" ? "30 дни" : "Всичко"}
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
        </div>

        {allUsers.length > 0 && (
          <div className="space-y-2">
            <p className="t-small font-medium text-muted-foreground">Потребители (по подразбиране — всички):</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-border rounded-lg p-3 bg-muted/20">
              {allUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-1.5 cursor-pointer text-sm hover:text-primary">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {/* Consistent label: always anchor identity by email, prefix
                      with the name only when present (#A2.9). */}
                  <span>{u.name?.trim() ? `${u.name.trim()} — ${u.email}` : u.email}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Button onClick={loadAnalyses} disabled={loadingList} variant="outline" className="gap-2">
          {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Зареди анализи
        </Button>
      </div>

      {/* AI Summary */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="t-subheading font-semibold">AI Обобщение</h2>
        </div>
        <p className="t-small text-muted-foreground">
          Анализира всички AI оценки за избрания период и дава конкретни препоръки за екипа.
        </p>
        <Button onClick={generateSummary} disabled={summaryLoading} className="gap-2">
          {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Обобщи
        </Button>

        {summaryError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-destructive t-small">
            {summaryError}
          </div>
        )}

        {summaryResult && (
          <div className="space-y-4 pt-2">
            {summaryResult.stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/40 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{summaryResult.stats.total}</div>
                  <div className="t-small text-muted-foreground mt-0.5">Анализа</div>
                </div>
                <div className="bg-muted/40 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{summaryResult.stats.avgScore}/10</div>
                  <div className="t-small text-muted-foreground mt-0.5">Средна оценка</div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <div className="t-small font-semibold text-green-700 mb-2">Силни страни</div>
                  {summaryResult.stats.topStrengths.slice(0, 3).map((s, i) => (
                    <div key={i} className="t-small text-green-600 leading-snug">· {s}</div>
                  ))}
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div className="t-small font-semibold text-orange-700 mb-2">За подобрение</div>
                  {summaryResult.stats.topImprovements.slice(0, 3).map((s, i) => (
                    <div key={i} className="t-small text-orange-600 leading-snug">· {s}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-muted/20 rounded-xl p-5 border border-border">
              <p className="t-small font-semibold text-muted-foreground mb-3">AI Препоръки за екипа</p>
              <div className="t-body leading-relaxed space-y-3 [&_h1]:t-heading [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:t-subheading [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:t-body [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_strong]:font-semibold">
                <ReactMarkdown>{summaryResult.summary}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analyses list */}
      {analyses.length > 0 && (
        <div className="space-y-3">
          <h2 className="t-subheading font-semibold">
            {analyses.length} анализа в периода
          </h2>
          {analyses.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-border overflow-hidden">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/20"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {a.overallScore != null ? (
                    <div className={cn(
                      "text-xl font-bold shrink-0 w-12 text-center rounded-xl py-1",
                      a.overallScore >= 8 ? "bg-green-50 text-green-700" :
                      a.overallScore >= 6 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"
                    )}>
                      {a.overallScore.toFixed(1)}
                    </div>
                  ) : (
                    <div className="text-xl font-bold shrink-0 w-12 text-center bg-muted rounded-xl py-1 text-muted-foreground">—</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium t-body truncate">{a.userName ?? a.userEmail ?? "—"}</p>
                    <p className="t-small text-muted-foreground">{a.botTitle ?? "—"} · {formatDate(a.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/me/conversations/${a.conversationId}?from=${encodeURIComponent("/admin/analytics")}`}
                    onClick={(e) => e.stopPropagation()}
                    className="t-small text-primary hover:underline"
                  >
                    Виж разговора →
                  </Link>
                  {expanded === a.id
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>

              {expanded === a.id && (
                <div className="border-t border-border p-5 space-y-4 bg-muted/10">
                  {a.summary && (
                    <div>
                      <p className="t-small font-semibold text-muted-foreground mb-1">Обобщение</p>
                      <p className="t-body">{a.summary}</p>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    {a.strengths && a.strengths.length > 0 && (
                      <div>
                        <p className="t-small font-semibold text-green-700 mb-2">Силни страни</p>
                        <ul className="space-y-1">
                          {a.strengths.map((s, i) => (
                            <li key={i} className="t-small text-foreground flex gap-2">
                              <span className="text-green-500 shrink-0">✓</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.improvements && a.improvements.length > 0 && (
                      <div>
                        <p className="t-small font-semibold text-orange-700 mb-2">Области за подобрение</p>
                        <ul className="space-y-1">
                          {a.improvements.map((s, i) => (
                            <li key={i} className="t-small text-foreground flex gap-2">
                              <span className="text-orange-500 shrink-0">→</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {analyses.length === 0 && !loadingList && (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <p className="t-body text-muted-foreground">
            Натиснете <strong>Зареди анализи</strong> за да видите резултатите
          </p>
        </div>
      )}
    </div>
  );
}
