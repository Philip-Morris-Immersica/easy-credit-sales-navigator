"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2 } from "lucide-react";

export function KBIngestButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ chunksStored: number } | null>(null);
  const [error, setError] = useState("");

  async function handleIngest() {
    if (!confirm("Ще изтрие старите чанкове и ще генерира нови. Продължи?")) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/ingest-kb", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleIngest} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {loading ? "Индексиране…" : "Преиндексирай tree.ts"}
      </Button>
      {result && (
        <div className="flex items-center gap-2 text-green-600 t-body">
          <CheckCircle2 className="h-4 w-4" />
          {result.chunksStored} чанка успешно индексирани
        </div>
      )}
      {error && <p className="t-small text-destructive">{error}</p>}
    </div>
  );
}
