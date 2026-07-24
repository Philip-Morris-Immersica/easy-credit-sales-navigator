"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BarChart2, Loader2 } from "lucide-react";

/**
 * On-demand analysis trigger for a conversation that doesn't have one yet.
 * Used by admins/HR (and the owner) to produce feedback for sessions that were
 * left unfinished. The server enforces the minimum-replies gate and marks
 * abandoned sessions as "incomplete" so unreached stages aren't penalised.
 */
export function GenerateAnalysisButton({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || "Грешка при генериране на анализ.");
        return;
      }
      router.refresh();
    } catch {
      setError("Грешка при генериране на анализ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleGenerate} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
        {loading ? "Генериране…" : "Генерирай анализ"}
      </Button>
      {error && <p className="t-small text-destructive">{error}</p>}
    </div>
  );
}
