"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ExportResultsButton } from "@/components/ExportResultsButton";
import { Loader2, Trash2 } from "lucide-react";

interface Props {
  userId: string;
  email: string;
  name: string | null;
  conversationCount: number;
}

/**
 * Окончателно изтриване на потребител (Т5). Двойно потвърждение: диалог +
 * въвеждане на имейла. Деактивирането си остава отделно (UserActiveToggle).
 */
export function UserDeleteButton({ userId, email, name, conversationCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  async function handleDelete() {
    if (!matches) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Грешка при изтриване.");
        return;
      }
      router.push("/admin/users");
      router.refresh();
    } catch {
      setError("Грешка при изтриване.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTyped("");
          setError("");
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" className="gap-1.5" />}>
        <Trash2 className="h-3.5 w-3.5" />
        Изтрий окончателно
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Окончателно изтриване на потребител</AlertDialogTitle>
          <AlertDialogDescription>
            Ще бъде изтрит акаунтът на <strong>{name ?? email}</strong> ({email}) заедно с{" "}
            <strong>всички негови разговори ({conversationCount}), стенограми и анализи</strong>.
            Това е <strong>необратимо</strong> — данните не могат да бъдат възстановени. Документите в
            „База знания“ и журналът с действията се запазват, без връзка към потребителя.
            Ако искате само да спрете достъпа, използвайте „Деактивирай“.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <span className="t-small text-muted-foreground">Преди изтриване изтеглете резултатите.</span>
          <ExportResultsButton href={`/api/admin/users/${userId}/export`} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm-email" className="t-small font-medium">
            За потвърждение въведете имейла: <span className="font-mono">{email}</span>
          </label>
          <Input
            id="confirm-email"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={email}
            autoComplete="off"
            disabled={loading}
          />
        </div>

        {error && <p className="t-small text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Отказ</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={!matches || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Изтрий окончателно"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
