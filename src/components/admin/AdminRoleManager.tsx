"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Loader2, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow { id: string; name: string | null; email: string; role: string; }

type AssignableRole = "user" | "admin" | "it";

export function AdminRoleManager({
  users,
  currentRole,
  currentUserId,
}: {
  users: UserRow[];
  currentRole: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const isIT = currentRole === "it";
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<AssignableRole>("admin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [revokeTarget, setRevokeTarget] = useState<UserRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return users
      .filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 8);
  }, [query, users]);

  function selectUser(user: UserRow) {
    setQuery(user.email);
    setOpen(false);
    setHighlight(0);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    setHighlight(0);
    setMessage("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectUser(matches[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  async function handleGrant() {
    if (!query.trim()) return;
    setLoading(true);
    setMessage("");
    setOpen(false);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error); return; }
      setMessage("Ролята е обновена успешно.");
      setQuery("");
      router.refresh();
    } catch (e) {
      setMessage("Грешка: " + e);
    } finally {
      setLoading(false);
    }
  }

  const privilegedUsers = users.filter((u) =>
    isIT ? u.role !== "user" : u.role === "admin"
  );

  function canRevoke(user: UserRow) {
    if (user.id === currentUserId) return false;
    if (currentRole === "admin") return user.role === "admin";
    if (currentRole === "it") return user.role === "admin" || user.role === "it";
    return false;
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: revokeTarget.email, role: "user" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRevokeError(data.error ?? "Грешка при премахване на достъпа.");
        return;
      }
      setRevokeTarget(null);
      setMessage("Достъпът е премахнат успешно.");
      router.refresh();
    } catch (e) {
      setRevokeError("Грешка: " + e);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Задай роля по имейл или име</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1 flex-1 min-w-48">
            <Label className="t-small">Имейл или име</Label>
            <div className="relative">
              <Input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => {
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  if (query.trim()) setOpen(true);
                }}
                onBlur={() => {
                  blurTimer.current = setTimeout(() => setOpen(false), 150);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Име или user@example.com"
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls="user-role-suggestions"
                aria-autocomplete="list"
              />
              {open && query.trim() && (
                <div
                  id="user-role-suggestions"
                  role="listbox"
                  className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-white shadow-md"
                >
                  {matches.length === 0 ? (
                    <p className="t-small text-muted-foreground px-3 py-2">
                      Няма намерени потребители
                    </p>
                  ) : (
                    matches.map((u, i) => (
                      <button
                        key={u.id}
                        type="button"
                        role="option"
                        aria-selected={i === highlight}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
                          i === highlight ? "bg-muted" : "hover:bg-muted/70"
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => selectUser(u)}
                      >
                        <span className="t-body font-medium">{u.name ?? "—"}</span>
                        <span className="t-small text-muted-foreground">{u.email}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="t-small">Роля</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                {isIT && <SelectItem value="it">it</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGrant} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Приложи
          </Button>
        </div>
        {message && (
          <p className={cn("t-small", message.includes("успешно") ? "text-green-600" : "text-destructive")}>
            {message}
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 space-y-3">
        <h2 className="t-subheading font-semibold">Потребители с роля</h2>
        <div className="space-y-2">
          {privilegedUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <div className="t-body font-medium">{u.name ?? "—"}</div>
                <div className="t-small text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn(
                  u.role === "it" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                )}>
                  {u.role}
                </Badge>
                {canRevoke(u) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    title="Премахни достъп"
                    aria-label={`Премахни достъпа на ${u.name ?? u.email}`}
                    onClick={() => {
                      setRevokeError("");
                      setRevokeTarget(u);
                    }}
                  >
                    <UserMinus />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {privilegedUsers.length === 0 && (
            <p className="t-body text-muted-foreground text-center py-4">Няма потребители с специална роля.</p>
          )}
        </div>
      </div>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(next) => {
          if (!next && !revoking) {
            setRevokeTarget(null);
            setRevokeError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Премахване на достъп</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да премахнете достъпа на{" "}
              <span className="font-medium text-foreground">
                {revokeTarget?.name ?? revokeTarget?.email}
              </span>
              {revokeTarget?.name ? ` (${revokeTarget.email})` : ""}? Потребителят ще остане в системата, но вече няма да има {revokeTarget?.role === "it" ? "IT" : "администраторски"} права.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeError && <p className="t-small text-destructive">{revokeError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Отказ</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ок"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
