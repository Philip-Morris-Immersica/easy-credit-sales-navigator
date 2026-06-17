"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, TrendingUp, TrendingDown, Star } from "lucide-react";

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

export function AnalysisFeedback({ analysis }: { analysis: AnalysisData }) {
  const score = analysis.overallScore ?? 0;
  const scoreColor =
    score >= 8 ? "text-green-600" : score >= 6 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-6">
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
