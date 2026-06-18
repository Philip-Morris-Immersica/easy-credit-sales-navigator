"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, FileCode, Edit3, Eye } from "lucide-react";

export function KBEditor() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch("/api/admin/kb-content")
      .then((r) => r.json())
      .then((d) => {
        if (d.content) setContent(d.content);
        else setError(d.error ?? "Неизвестна грешка");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/kb-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Грешка при запазване");
      setSaved(true);
      setEditing(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Зареждане на файла…
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="text-destructive t-body py-4">
        Грешка при четене на файла: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground t-small">
          <FileCode className="h-4 w-4" />
          src/content/sales-navigator/tree.ts · {(content.length / 1024).toFixed(1)} KB
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <div className="flex items-center gap-1.5 text-green-600 t-small">
              <CheckCircle2 className="h-4 w-4" />
              Запазено
            </div>
          )}
          {error && <span className="text-destructive t-small">{error}</span>}
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Преглед
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {saving ? "Запазване…" : "Запази файла"}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Edit3 className="h-3.5 w-3.5 mr-1.5" />
              Редактирай
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setSaved(false); }}
          className="w-full h-[60vh] font-mono text-xs border border-border rounded-xl p-4 resize-y bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
          spellCheck={false}
        />
      ) : (
        <pre className="w-full h-[60vh] overflow-auto font-mono text-xs border border-border rounded-xl p-4 bg-muted/30 whitespace-pre">
          {content}
        </pre>
      )}

      {editing && (
        <p className="t-small text-orange-600">
          ⚠ Внимание: промените в tree.ts влизат в сила само след „Запази файла" и след ново реиндексиране.
          Грешен синтаксис може да счупи приложението.
        </p>
      )}
    </div>
  );
}
