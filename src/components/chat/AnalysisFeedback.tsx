"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, TrendingUp, TrendingDown, Star, Download } from "lucide-react";

interface Criterion {
  name: string;
  score: number;
  comment: string;
}

interface AnalysisData {
  overallScore: number;
  criteria: Criterion[];
  strengths: string[];
  improvements: string[];
  summary: string;
}

/** Minimal HTML-escaping so free-text AI output can't break the exported document. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Builds a self-contained, printable HTML document (Bulgarian) for the analysis. */
function buildAnalysisHtml(analysis: AnalysisData, title: string): string {
  const score = analysis.overallScore ?? 0;
  const scoreColor = score >= 8 ? "#16a34a" : score >= 6 ? "#ca8a04" : "#dc2626";
  const generatedAt = new Date().toLocaleString("bg", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const criteriaHtml = (analysis.criteria ?? [])
    .map((c) => {
      const cColor = c.score >= 8 ? "#16a34a" : c.score >= 6 ? "#ca8a04" : "#dc2626";
      return `
      <div class="criterion">
        <div class="criterion-header">
          <span class="criterion-name">${escapeHtml(c.name)}</span>
          <span class="criterion-score" style="color:${cColor}">${c.score}/10</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, c.score * 10))}%;background:${cColor}"></div></div>
        ${c.comment ? `<p class="criterion-comment">${escapeHtml(c.comment)}</p>` : ""}
      </div>`;
    })
    .join("");

  const strengthsHtml = (analysis.strengths ?? [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");
  const improvementsHtml = (analysis.improvements ?? [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a2530; max-width: 720px; margin: 0 auto; padding: 32px 24px; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  .meta { color: #6b7684; font-size: 0.85rem; margin-bottom: 1.75rem; }
  .score-box { text-align: center; padding: 20px 0 28px; border-bottom: 1px solid #e5e8eb; margin-bottom: 24px; }
  .score-value { font-size: 3rem; font-weight: 800; color: ${scoreColor}; }
  .score-suffix { font-size: 1.25rem; color: #9baab3; font-weight: 500; }
  .summary { max-width: 520px; margin: 12px auto 0; color: #3d4a54; }
  h2 { font-size: 1.05rem; margin: 28px 0 12px; color: #1a2530; }
  .criterion { margin-bottom: 16px; }
  .criterion-header { display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600; margin-bottom: 4px; }
  .criterion-score { font-weight: 700; }
  .bar-track { background: #eef1f3; border-radius: 6px; height: 6px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 6px; }
  .criterion-comment { font-size: 0.85rem; color: #6b7684; margin: 6px 0 0; }
  .cols { display: flex; gap: 24px; flex-wrap: wrap; }
  .col { flex: 1; min-width: 220px; }
  .col h3 { font-size: 0.95rem; margin: 0 0 8px; }
  .col.strengths h3 { color: #15803d; }
  .col.improvements h3 { color: #c2410c; }
  ul { padding-left: 20px; margin: 0; font-size: 0.9rem; }
  li { margin-bottom: 6px; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e5e8eb; font-size: 0.75rem; color: #9baab3; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Генериран на ${escapeHtml(generatedAt)}</p>

  <div class="score-box">
    <div><span class="score-value">${score.toFixed(1)}</span><span class="score-suffix">/10</span></div>
    ${analysis.summary ? `<p class="summary">${escapeHtml(analysis.summary)}</p>` : ""}
  </div>

  ${criteriaHtml ? `<h2>Критерии за оценка</h2>${criteriaHtml}` : ""}

  <div class="cols">
    ${strengthsHtml ? `<div class="col strengths"><h3>Силни страни</h3><ul>${strengthsHtml}</ul></div>` : ""}
    ${improvementsHtml ? `<div class="col improvements"><h3>За подобрение</h3><ul>${improvementsHtml}</ul></div>` : ""}
  </div>

  <p class="footer">Easy Credit — Sales Navigator · Анализ на разговор</p>
</body>
</html>`;
}

/**
 * Opens the analysis in a hidden iframe and triggers the browser's print
 * dialog, where the user picks "Save as PDF". This keeps Cyrillic rendering
 * pixel-perfect (native fonts) and needs no PDF library. The document title
 * becomes the default PDF filename.
 */
function downloadAnalysisPdf(analysis: AnalysisData, title: string) {
  const html = buildAnalysisHtml(analysis, title);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const printAndCleanup = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);
    }
  };

  // Print once the iframe has laid out; the timeout is a fallback for browsers
  // that don't fire `onload` for document.write content.
  if (iframe.contentWindow) {
    iframe.contentWindow.onload = printAndCleanup;
  }
  setTimeout(printAndCleanup, 400);
}

export function AnalysisFeedback({
  analysis,
  title = "Анализ на разговор",
}: {
  analysis: AnalysisData;
  /** Kept for call-site compatibility; no longer used for the export filename. */
  conversationId?: string;
  /** Shown as the document title inside the exported PDF (and its filename). */
  title?: string;
}) {
  const score = analysis.overallScore ?? 0;
  const scoreColor =
    score >= 8 ? "text-green-600" : score >= 6 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Download */}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => downloadAnalysisPdf(analysis, title)}
        >
          <Download className="h-3.5 w-3.5" />
          Свали като PDF
        </Button>
      </div>

      {/* Overall score */}
      <div className="text-center space-y-2">
        <div className={`text-5xl font-bold ${scoreColor}`}>
          {score.toFixed(1)}
          <span className="text-2xl text-muted-foreground font-normal">/10</span>
        </div>
        <div className="flex justify-center">
          {Array.from({ length: 10 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < Math.round(score)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        {analysis.summary && (
          <p className="t-body text-foreground/80 max-w-md mx-auto">{analysis.summary}</p>
        )}
      </div>

      {/* Criteria */}
      {analysis.criteria?.length > 0 && (
        <div className="space-y-3">
          <h3 className="t-body font-semibold">Критерии за оценка</h3>
          {analysis.criteria.map((c) => (
            <div key={c.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="t-small font-medium">{c.name}</span>
                <Badge
                  variant="secondary"
                  className={
                    c.score >= 8
                      ? "bg-green-100 text-green-700"
                      : c.score >= 6
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  {c.score}/10
                </Badge>
              </div>
              <Progress value={c.score * 10} className="h-1.5" />
              {c.comment && (
                <p className="t-small text-muted-foreground">{c.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Strengths & improvements */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {analysis.strengths?.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-green-700">
              <TrendingUp className="h-4 w-4" />
              <span className="t-body font-semibold">Силни страни</span>
            </div>
            <ul className="space-y-1">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 t-small">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.improvements?.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-orange-600">
              <TrendingDown className="h-4 w-4" />
              <span className="t-body font-semibold">За подобрение</span>
            </div>
            <ul className="space-y-1">
              {analysis.improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 t-small">
                  <span className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-400">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
