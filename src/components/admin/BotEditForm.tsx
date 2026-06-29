"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, MessageSquare, BarChart2 } from "lucide-react";
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
    // Simulation / chat
    welcomeMessage: bot.welcomeMessage,
    systemPrompt: bot.systemPrompt,
    model: bot.model ?? "gpt-4.1-mini",
    temperature: Number(bot.temperature ?? 0.7),
    maxTokens: Number(bot.maxTokens ?? 2000),
    // Analysis
    analysisPrompt: bot.analysisPrompt ?? "",
    analysisModel: bot.analysisModel ?? "",
    analysisTemperature: Number(bot.analysisTemperature ?? 0.3),
    analysisMaxTokens: Number(bot.analysisMaxTokens ?? 1500),
    // General
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

      {/* ── FIRST REPLY ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Първа реплика на бота</h2>
        <p className="t-small text-muted-foreground">
          Първото съобщение, което ботът показва при стартиране на разговор. Видимо в транскрипта.
        </p>
        <Textarea
          value={form.welcomeMessage}
          onChange={(e) => update("welcomeMessage", e.target.value)}
          className="min-h-[80px] resize-y"
          placeholder="Здравей! Аз съм…"
        />
      </div>

      {/* ── SIMULATION SECTION ───────────────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-blue-200 overflow-hidden">
        <div className="bg-blue-50 px-6 py-3 flex items-center gap-2 border-b border-blue-200">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <h2 className="t-subheading font-semibold text-blue-900">Симулация — Промпт и настройки</h2>
        </div>

        <div className="p-6 space-y-6 bg-white">
          {/* System prompt */}
          <div className="space-y-2">
            <Label className="t-body font-medium">Системен промпт</Label>
            <Textarea
              value={form.systemPrompt}
              onChange={(e) => update("systemPrompt", e.target.value)}
              className="min-h-[200px] resize-y font-mono text-sm"
              placeholder="Ти играеш ролята на…"
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label className="t-body font-medium">Модел</Label>
            <Select value={form.model} onValueChange={(v) => update("model", v)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="t-body font-medium">Температура</Label>
              <span className="t-small font-mono text-muted-foreground">{Number(form.temperature).toFixed(2)}</span>
            </div>
            <Slider
              value={[Number(form.temperature)]}
              onValueChange={(vals) => update("temperature", Number((vals as number[])[0]))}
              min={0} max={2} step={0.05}
            />
            <p className="t-small text-muted-foreground">По-ниска = по-прецизен · По-висока = по-творчески</p>
          </div>

          {/* Max tokens */}
          <div className="space-y-1.5">
            <Label className="t-body font-medium">Макс. токени (изход)</Label>
            <Input
              type="number"
              value={form.maxTokens}
              onChange={(e) => update("maxTokens", parseInt(e.target.value) || 2000)}
              className="w-32"
              min={100} max={8000}
            />
          </div>
        </div>
      </div>

      {/* ── ANALYSIS SECTION (simulation only) ───────────────────────────── */}
      {bot.kind === "simulation" && (
        <div className="rounded-2xl border-2 border-green-200 overflow-hidden">
          <div className="bg-green-50 px-6 py-3 flex items-center gap-2 border-b border-green-200">
            <BarChart2 className="h-4 w-4 text-green-600" />
            <h2 className="t-subheading font-semibold text-green-900">Анализ — Промпт и настройки</h2>
          </div>

          <div className="p-6 space-y-6 bg-white">
            {/* Analysis prompt */}
            <div className="space-y-2">
              <Label className="t-body font-medium">Промпт за анализ</Label>
              <p className="t-small text-muted-foreground">
                Промптът, с който AI анализира разговора след симулация. Трябва да върне валиден JSON.
              </p>
              <Textarea
                value={form.analysisPrompt}
                onChange={(e) => update("analysisPrompt", e.target.value)}
                className="min-h-[200px] resize-y font-mono text-sm"
              />
            </div>

            {/* Analysis model */}
            <div className="space-y-1.5">
              <Label className="t-body font-medium">Модел</Label>
              <Select
                value={form.analysisModel || "__default__"}
                onValueChange={(v) => update("analysisModel", v === "__default__" ? "" : v)}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">По подразбиране (gpt-4.1-mini)</SelectItem>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Analysis temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="t-body font-medium">Температура</Label>
                <span className="t-small font-mono text-muted-foreground">{Number(form.analysisTemperature).toFixed(2)}</span>
              </div>
              <Slider
                value={[Number(form.analysisTemperature)]}
                onValueChange={(vals) => update("analysisTemperature", Number((vals as number[])[0]))}
                min={0} max={1} step={0.05}
              />
              <p className="t-small text-muted-foreground">
                Препоръчително: 0.2–0.4 за по-стабилен JSON изход
              </p>
            </div>

            {/* Analysis max tokens */}
            <div className="space-y-1.5">
              <Label className="t-body font-medium">Макс. токени (изход)</Label>
              <Input
                type="number"
                value={form.analysisMaxTokens}
                onChange={(e) => update("analysisMaxTokens", parseInt(e.target.value) || 1500)}
                className="w-32"
                min={500} max={4000}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── GENERAL SETTINGS ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Общи</h2>
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

      {/* Save */}
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
