"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface Props {
  userId: string;
  active: boolean;
  isSelf: boolean;
}

export function UserActiveToggle({ userId, active, isSelf }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function handleToggle() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Грешка при обновяване.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Грешка при обновяване.");
    } finally {
      setLoading(false);
    }
  }

  if (isSelf) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant={active ? "destructive" : "outline"} size="sm" />
        }
      >
        {active ? "Деактивирай" : "Активирай"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {active ? "Деактивиране на потребител" : "Активиране на потребител"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {active
              ? "Потребителят няма да може да влиза в системата, докато не бъде активиран отново. Данните му (разговори, анализи) се запазват."
              : "Потребителят ще може отново да влиза в системата."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="t-small text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Отказ</AlertDialogCancel>
          <AlertDialogAction
            variant={active ? "destructive" : "default"}
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? "Деактивирай" : "Активирай"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
