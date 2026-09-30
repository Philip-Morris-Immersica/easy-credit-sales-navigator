"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronUp, History, Loader2, RotateCcw } from "lucide-react";

export interface BotVersionItem {
  id: string;
  changedAt: string; // ISO
  changedByName: string | null;
  reason: string;
  systemPrompt: string;
  analysisPrompt: string | null;
  model: string;
  temperature: number;
}

const REASON_LABEL: Record<string, string> = {
  initial: "Първоначално състояние",
  edit: "Заменена при редакция",
  restore: "Заменена при връщане на версия",
  script: "Заменена от скрипт",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BotVersionHistory({
  botKey,
  versions,
}: {
  botKey: string;
  versions: BotVersionItem[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const confirmVersion = versions.find((v) => v.id === confirmId) ?? null;

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      const res = await fetch(
        `/api/admin/bots/${botKey}/versions/${id}/restore`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(await res.text());
      setConfirmId(null);
      // Пълно презареждане, за да се пресъздаде формата с възстановените стойности.
      window.location.reload();
    } catch (e) {
      alert("Грешка при връщане на версията: " + e);
      setRestoringId(null);
      router.refresh();
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="t-subheading font-semibold">История на версиите</h2>
      </div>
      <p className="t-small text-muted-foreground">
        Преди всяка промяна текущото състояние се запазва (последните 10 версии). „Върни“ възстановява
        промптовете и настройките от избраната версия; текущото състояние също се запазва, така че
        връщането може да се отмени.
      </p>

      {versions.length === 0 ? (
        <p className="t-body text-muted-foreground">Още няма запазени версии.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {versions.map((v) => {
            const expanded = expandedId === v.id;
            return (
              <li key={v.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="t-body font-medium">{formatDate(v.changedAt)}</div>
                    <div className="t-small text-muted-foreground">
                      {REASON_LABEL[v.reason] ?? v.reason}
                      {v.changedByName ? ` · ${v.changedByName}` : ""}
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {v.model} · t={v.temperature}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expanded ? null : v.id)}
                    className="gap-1"
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {expanded ? "Скрий" : "Виж"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmId(v.id)}
                    disabled={restoringId !== null}
                    className="gap-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Върни тази версия
                  </Button>
                </div>

                {expanded && (
                  <div className="space-y-3">
                    <div>
                      <div className="t-small font-medium mb-1">Системен промпт</div>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs font-mono">
                        {v.systemPrompt || "—"}
                      </pre>
                    </div>
                    {v.analysisPrompt !== null && (
                      <div>
                        <div className="t-small font-medium mb-1">Промпт за анализ</div>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs font-mono">
                          {v.analysisPrompt || "—"}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open && restoringId === null) setConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Връщане на версия</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmVersion
                ? `Промптовете и настройките ще бъдат заменени с версията от ${formatDate(confirmVersion.changedAt)}. Текущото състояние се запазва в историята.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoringId !== null}>Отказ</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoringId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (confirmId) handleRestore(confirmId);
              }}
            >
              {restoringId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Върни
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
