"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { Bot } from "@/db/schema";

interface BotEditFormProps {
  bot: Bot;
  availableModels: string[];
}

export function BotEditForm({ bot, availableModels }: BotEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    systemPrompt: bot.systemPrompt,
    analysisPrompt: bot.analysisPrompt ?? "",
    welcomeMessage: bot.welcomeMessage,
    model: bot.model ?? "gpt-4.1-mini",
    temperature: bot.temperature ?? 0.7,
    maxTokens: bot.maxTokens ?? 2000,
    enabled: bot.enabled ?? true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function update(k: keyof typeof form, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bots/${bot.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      router.refresh();
    } catch (e) {
      alert("Грешка при запазване: " + e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Приветствено съобщение</h2>
        <div className="space-y-1.5">
          <Label className="t-body font-medium">Текст</Label>
          <Textarea
            value={form.welcomeMessage}
            onChange={(e) => update("welcomeMessage", e.target.value)}
            className="min-h-[80px] resize-y"
            placeholder="Здравей! Аз съм…"
          />
        </div>
      </div>

      {/* System prompt */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Системен промпт</h2>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) => update("systemPrompt", e.target.value)}
          className="min-h-[200px] resize-y font-mono text-sm"
          placeholder="Ти играеш ролята на…"
        />
      </div>

      {/* Analysis prompt (simulation only) */}
      {bot.kind === "simulation" && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h2 className="t-subheading font-semibold">Промпт за анализ</h2>
          <p className="t-small text-muted-foreground">
            Промптът, с който AI анализира разговора след симулация. Трябва да върне JSON.
          </p>
          <Textarea
            value={form.analysisPrompt}
            onChange={(e) => update("analysisPrompt", e.target.value)}
            className="min-h-[200px] resize-y font-mono text-sm"
          />
        </div>
      )}

      {/* Model settings */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-6">
        <h2 className="t-subheading font-semibold">Настройки на модела</h2>

        <div className="space-y-1.5">
          <Label className="t-body font-medium">Модел</Label>
          <Select value={form.model} onValueChange={(v) => update("model", v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="t-body font-medium">Температура</Label>
            <span className="t-small text-muted-foreground">{form.temperature.toFixed(2)}</span>
          </div>
          <Slider
            value={[form.temperature]}
            onValueChange={(vals) => update("temperature", (vals as number[])[0])}
            min={0} max={2} step={0.05}
            className="w-full"
          />
          <p className="t-small text-muted-foreground">По-ниска = по-прецизен · По-висока = по-творчески</p>
        </div>

        <div className="space-y-1.5">
          <Label className="t-body font-medium">Макс. токени изход</Label>
          <Input
            type="number"
            value={form.maxTokens}
            onChange={(e) => update("maxTokens", parseInt(e.target.value) || 1000)}
            className="w-32"
            min={100}
            max={8000}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="t-body font-medium">Активен</Label>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
            className="h-4 w-4"
          />
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
