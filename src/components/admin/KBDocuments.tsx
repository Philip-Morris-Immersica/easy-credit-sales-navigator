"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Download,
  FileUp,
  History,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { KB_CATEGORIES } from "@/lib/kb-categories";

export interface KBDocVersionItem {
  id: string;
  version: number;
  changedAt: string;
  changedByName: string | null;
  reason: string;
}

export interface KBDocItem {
  id: string;
  title: string;
  category: string;
  fileName: string;
  version: number;
  status: string;
  uploadedByName: string | null;
  updatedAt: string;
  versions: KBDocVersionItem[];
}

const REASON_LABEL: Record<string, string> = {
  replace: "Заменена с нова версия",
  restore: "Заменена при връщане на версия",
  archive: "Архивирана",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("bg-BG", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

type Confirm =
  | { kind: "archive"; docId: string; title: string }
  | { kind: "restore"; docId: string; versionId: string; version: number }
  | null;

export function KBDocuments({ documents }: { documents: KBDocItem[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null); // "upload" | docId
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [showArchived, setShowArchived] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);

  const visible = documents.filter((d) => showArchived || d.status === "active");
  const archivedCount = documents.filter((d) => d.status === "archived").length;

  async function send(form: FormData, key: string, okText: (r: { chunks: number; version: number }) => string) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/kb-documents", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Грешка при качване");
      setMessage({ ok: true, text: okText(data) });
      router.refresh();
      return true;
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload() {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    if (title.trim()) form.set("title", title.trim());
    if (category) form.set("category", category);
    const ok = await send(form, "upload", (r) => `Документът е качен и индексиран (${r.chunks} откъса).`);
    if (ok) {
      setFile(null);
      setTitle("");
      setCategory("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleReplace(f: File) {
    if (!replaceId) return;
    const form = new FormData();
    form.set("file", f);
    form.set("documentId", replaceId);
    await send(form, replaceId, (r) => `Качена е версия ${r.version} (${r.chunks} откъса). Предишната е запазена в историята.`);
    setReplaceId(null);
    if (replaceRef.current) replaceRef.current.value = "";
  }

  async function patch(docId: string, body: Record<string, unknown>, okText: string) {
    setBusy(docId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/kb-documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Грешка");
      setMessage({ ok: true, text: okText });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Качване */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="t-subheading font-semibold">Качване на документ</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="kb-file">Файл (.docx, .md, .txt)</Label>
            <Input
              id="kb-file"
              ref={fileRef}
              type="file"
              accept=".docx,.md,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kb-title">Заглавие (по избор)</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ако е празно — от документа или от името на файла"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Категория</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Изберете категория" />
              </SelectTrigger>
              <SelectContent>
                {KB_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleUpload} disabled={!file || busy !== null} className="gap-2">
            {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy === "upload" ? "Качване и индексиране…" : "Качи"}
          </Button>
          <span className="t-small text-muted-foreground">
            Категорията може да е записана и в самия документ (ред „Категория: …“ най-отгоре).
          </span>
        </div>
        {message && (
          <p className={message.ok ? "t-body text-green-600" : "t-body text-destructive"}>{message.text}</p>
        )}
      </div>

      {/* Списък */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="t-subheading font-semibold">Документи ({visible.length})</h2>
          {archivedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Скрий архивираните" : `Покажи архивираните (${archivedCount})`}
            </Button>
          )}
        </div>

        <input
          ref={replaceRef}
          type="file"
          accept=".docx,.md,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleReplace(f);
          }}
        />

        {visible.length === 0 ? (
          <p className="t-body text-muted-foreground">Още няма качени документи.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {visible.map((d) => {
              const open = expanded === d.id;
              const archived = d.status === "archived";
              return (
                <li key={d.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="t-body font-medium flex items-center gap-2">
                        {d.title}
                        {archived && <Badge variant="secondary">Архивиран</Badge>}
                      </div>
                      <div className="t-small text-muted-foreground">
                        {d.category} · версия {d.version} · {d.uploadedByName ?? "—"} · {fmt(d.updatedAt)} · {d.fileName}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => window.open(`/api/admin/kb-documents/${d.id}/download`)} className="gap-1">
                      <Download className="h-4 w-4" /> Изтегли
                    </Button>
                    {!archived && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => { setReplaceId(d.id); replaceRef.current?.click(); }}
                        className="gap-1"
                      >
                        {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Нова версия
                      </Button>
                    )}
                    {archived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => patch(d.id, { action: "unarchive" }, "Документът е възстановен и индексиран.")}
                        className="gap-1"
                      >
                        <ArchiveRestore className="h-4 w-4" /> Възстанови
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setConfirm({ kind: "archive", docId: d.id, title: d.title })}
                        className="gap-1"
                      >
                        <Archive className="h-4 w-4" /> Архивирай
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(open ? null : d.id)} className="gap-1">
                      <History className="h-4 w-4" />
                      Версии ({d.versions.length})
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {open && (
                    d.versions.length === 0 ? (
                      <p className="t-small text-muted-foreground">Няма по-стари версии. Предишната версия се запазва, когато качите нова.</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-lg border border-border">
                        {d.versions.map((v) => (
                          <li key={v.id} className="flex flex-wrap items-center gap-3 p-3 t-small">
                            <span className="flex-1">
                              Версия {v.version} · {fmt(v.changedAt)} · {REASON_LABEL[v.reason] ?? v.reason}
                              {v.changedByName ? ` · ${v.changedByName}` : ""}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/api/admin/kb-documents/${d.id}/download?versionId=${v.id}`)}
                              className="gap-1"
                            >
                              <Download className="h-4 w-4" /> Изтегли
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy !== null}
                              onClick={() => setConfirm({ kind: "restore", docId: d.id, versionId: v.id, version: v.version })}
                              className="gap-1"
                            >
                              <RotateCcw className="h-4 w-4" /> Върни
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => { if (!o && busy === null) setConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "archive" ? "Архивиране на документ" : "Връщане на версия"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "archive"
                ? `„${confirm.title}“ ще спре да се чете от Роби. Текстът се пази и документът може да бъде възстановен.`
                : confirm?.kind === "restore"
                  ? `Текущият текст ще бъде заменен с версия ${confirm.version}. Текущата версия се запазва в историята.`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Отказ</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy !== null}
              onClick={(e) => {
                e.preventDefault();
                if (!confirm) return;
                if (confirm.kind === "archive") patch(confirm.docId, { action: "archive" }, "Документът е архивиран.");
                else patch(confirm.docId, { action: "restore", versionId: confirm.versionId }, `Върната е версия ${confirm.version}.`);
              }}
            >
              {busy !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirm?.kind === "archive" ? "Архивирай" : "Върни"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
