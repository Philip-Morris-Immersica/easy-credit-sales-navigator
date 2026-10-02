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
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Download,
  FileUp,
  History,
  Loader2,
  RotateCcw,
  Trash2,
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
  archive: "Запазена при изтриване",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("bg-BG", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

type Confirm =
  | { kind: "archive"; docId: string; title: string }
  | { kind: "purge"; docId: string; title: string; versions: number }
  | { kind: "restore"; docId: string; versionId: string; version: number }
  | { kind: "deleteVersion"; docId: string; versionId: string; version: number }
  | { kind: "deleteAllVersions"; docId: string; title: string; count: number }
  | null;

const CONFIRM_TEXT: Record<
  NonNullable<Confirm>["kind"],
  { title: string; action: string; destructive: boolean; describe: (c: NonNullable<Confirm>) => string }
> = {
  archive: {
    title: "Изтриване на документ",
    action: "Изтрий",
    destructive: true,
    describe: (c) =>
      `„${"title" in c ? c.title : ""}“ спира да се чете от Роби веднага и отива в „Изтрити“. Оттам може да го възстановите или да го изтриете окончателно.`,
  },
  purge: {
    title: "Окончателно изтриване",
    action: "Изтрий окончателно",
    destructive: true,
    describe: (c) =>
      `„${"title" in c ? c.title : ""}“${c.kind === "purge" && c.versions > 0 ? ` и старите му версии (${c.versions})` : ""} ще бъдат изтрити завинаги. Това не може да се отмени.`,
  },
  restore: {
    title: "Връщане на версия",
    action: "Върни",
    destructive: false,
    describe: (c) =>
      `Текущият текст ще бъде заменен с версия ${"version" in c ? c.version : ""}. Текущата версия се запазва в историята.`,
  },
  deleteVersion: {
    title: "Изтриване на стара версия",
    action: "Изтрий версията",
    destructive: true,
    describe: (c) =>
      `Версия ${"version" in c ? c.version : ""} ще бъде изтрита завинаги. Текущата версия, която Роби чете, не се засяга.`,
  },
  deleteAllVersions: {
    title: "Изтриване на всички стари версии",
    action: "Изтрий всички",
    destructive: true,
    describe: (c) =>
      `Всички стари версии на „${"title" in c ? c.title : ""}“${c.kind === "deleteAllVersions" ? ` (${c.count})` : ""} ще бъдат изтрити завинаги. Текущата версия, която Роби чете, не се засяга.`,
  },
};

export function KBDocuments({
  documents,
  templates,
}: {
  documents: KBDocItem[];
  templates: readonly { file: string; label: string }[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null); // "upload" | docId
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [view, setView] = useState<"active" | "archived">("active");
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);

  const visible = documents.filter((d) => d.status === view);
  const activeCount = documents.filter((d) => d.status === "active").length;
  const archivedCount = documents.length - activeCount;

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

  async function patch(docId: string, body: Record<string, unknown> | null, okText: string) {
    setBusy(docId);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/kb-documents/${docId}`,
        body
          ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : { method: "DELETE" }
      );
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

  function runConfirm(c: NonNullable<Confirm>) {
    switch (c.kind) {
      case "archive":
        return patch(c.docId, { action: "archive" }, `„${c.title}“ е преместен в „Изтрити“. Роби вече не го чете.`);
      case "purge":
        return patch(c.docId, null, `„${c.title}“ е изтрит окончателно.`);
      case "restore":
        return patch(c.docId, { action: "restore", versionId: c.versionId }, `Върната е версия ${c.version}.`);
      case "deleteVersion":
        return patch(c.docId, { action: "deleteVersion", versionId: c.versionId }, `Версия ${c.version} е изтрита.`);
      case "deleteAllVersions":
        return patch(c.docId, { action: "deleteAllVersions" }, `Старите версии на „${c.title}“ са изтрити.`);
    }
  }

  const confirmText = confirm ? CONFIRM_TEXT[confirm.kind] : null;

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
        <div className="border-t border-border pt-4 space-y-2">
          <div className="t-small font-medium">Нямате документ? Свалете шаблон, попълнете го в Word и го качете:</div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <a
                key={t.file}
                href={`/templates/${t.file}`}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 t-small hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                {t.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Списък */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="t-subheading font-semibold">Документи</h2>
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <Button
              variant={view === "active" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => { setView("active"); setExpanded(null); }}
            >
              Активни ({activeCount})
            </Button>
            <Button
              variant={view === "archived" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => { setView("archived"); setExpanded(null); }}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" /> Изтрити ({archivedCount})
            </Button>
          </div>
        </div>
        {view === "archived" && (
          <p className="t-small text-muted-foreground">
            Роби не чете изтритите документи. Може да ги възстановите или да ги изтриете окончателно.
          </p>
        )}

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
          <p className="t-body text-muted-foreground">
            {view === "active" ? "Още няма качени документи." : "Няма изтрити документи."}
          </p>
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
                        {archived && <Badge variant="secondary">Изтрит</Badge>}
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
                    {!archived && (
                      <Button variant="ghost" size="sm" onClick={() => setExpanded(open ? null : d.id)} className="gap-1">
                        <History className="h-4 w-4" />
                        Стари версии ({d.versions.length})
                        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    )}
                    {archived ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => patch(d.id, { action: "unarchive" }, `„${d.title}“ е възстановен и Роби отново го чете.`)}
                          className="gap-1"
                        >
                          {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
                          Възстанови
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => setConfirm({ kind: "purge", docId: d.id, title: d.title, versions: d.versions.length })}
                          className="gap-1"
                        >
                          <Trash2 className="h-4 w-4" /> Изтрий окончателно
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setConfirm({ kind: "archive", docId: d.id, title: d.title })}
                        className="gap-1"
                      >
                        <Trash2 className="h-4 w-4" /> Изтрий
                      </Button>
                    )}
                  </div>

                  {open && !archived && (
                    d.versions.length === 0 ? (
                      <p className="t-small text-muted-foreground">Няма стари версии. Предишната версия се запазва, когато качите нова.</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="t-small text-muted-foreground">
                            Роби чете само текущата версия ({d.version}). Старите се пазят за връщане — последните 10.
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => setConfirm({ kind: "deleteAllVersions", docId: d.id, title: d.title, count: d.versions.length })}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> Изтрий всички стари версии
                          </Button>
                        </div>
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
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busy !== null}
                                aria-label={`Изтрий версия ${v.version}`}
                                title="Изтрий тази версия"
                                onClick={() => setConfirm({ kind: "deleteVersion", docId: d.id, versionId: v.id, version: v.version })}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
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
            <AlertDialogTitle>{confirmText?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm && confirmText ? confirmText.describe(confirm) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Отказ</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmText?.destructive ? "destructive" : "default"}
              disabled={busy !== null}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) runConfirm(confirm);
              }}
            >
              {busy !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirmText?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
