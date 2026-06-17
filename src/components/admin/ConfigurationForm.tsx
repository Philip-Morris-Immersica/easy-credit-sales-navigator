"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { ModelPricing } from "@/db/schema";

interface ConfigurationFormProps {
  initialPricing: ModelPricing[];
}

export function ConfigurationForm({ initialPricing }: ConfigurationFormProps) {
  const router = useRouter();
  const [pricing, setPricing] = useState(initialPricing.map(p => ({ ...p })));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [newIn, setNewIn] = useState("0");
  const [newOut, setNewOut] = useState("0");

  function updatePricing(model: string, field: "inputPer1k" | "outputPer1k", val: string) {
    setPricing(prev => prev.map(p => p.model === model ? { ...p, [field]: parseFloat(val) || 0 } : p));
    setSaved(false);
  }

  function addModel() {
    if (!newModel.trim()) return;
    setPricing(prev => [...prev, { model: newModel.trim(), inputPer1k: parseFloat(newIn) || 0, outputPer1k: parseFloat(newOut) || 0 }]);
    setNewModel(""); setNewIn("0"); setNewOut("0");
    setSaved(false);
  }

  function removeModel(model: string) {
    setPricing(prev => prev.filter(p => p.model !== model));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      router.refresh();
    } catch (e) {
      alert("Грешка: " + e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Ценоразпис на модели (USD / 1000 токени)</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left py-2 font-semibold text-muted-foreground t-small">Модел</th>
              <th className="text-left py-2 font-semibold text-muted-foreground t-small">Вход / 1k</th>
              <th className="text-left py-2 font-semibold text-muted-foreground t-small">Изход / 1k</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pricing.map((p) => (
              <tr key={p.model}>
                <td className="py-2 font-mono t-small">{p.model}</td>
                <td className="py-2">
                  <Input
                    type="number"
                    step="0.0001"
                    value={p.inputPer1k}
                    onChange={(e) => updatePricing(p.model, "inputPer1k", e.target.value)}
                    className="w-28 h-7 text-sm"
                  />
                </td>
                <td className="py-2">
                  <Input
                    type="number"
                    step="0.0001"
                    value={p.outputPer1k}
                    onChange={(e) => updatePricing(p.model, "outputPer1k", e.target.value)}
                    className="w-28 h-7 text-sm"
                  />
                </td>
                <td className="py-2">
                  <Button size="icon-xs" variant="ghost" onClick={() => removeModel(p.model)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add new model */}
        <div className="flex gap-2 items-end pt-2 border-t border-border">
          <div className="space-y-1">
            <Label className="t-small">Модел</Label>
            <Input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="gpt-4o-mini" className="w-40 h-8" />
          </div>
          <div className="space-y-1">
            <Label className="t-small">Вход</Label>
            <Input type="number" step="0.0001" value={newIn} onChange={(e) => setNewIn(e.target.value)} className="w-24 h-8" />
          </div>
          <div className="space-y-1">
            <Label className="t-small">Изход</Label>
            <Input type="number" step="0.0001" value={newOut} onChange={(e) => setNewOut(e.target.value)} className="w-24 h-8" />
          </div>
          <Button size="sm" variant="outline" onClick={addModel} className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" /> Добави
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Запазване…" : "Запази"}
        </Button>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-600 t-body">
            <CheckCircle2 className="h-4 w-4" />
            Запазено
          </div>
        )}
      </div>
    </div>
  );
}
