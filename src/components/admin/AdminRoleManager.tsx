"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow { id: string; name: string | null; email: string; role: string; }

export function AdminRoleManager({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin" | "it">("admin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleGrant() {
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error); return; }
      setMessage("Ролята е обновена успешно.");
      setEmail("");
      router.refresh();
    } catch (e) {
      setMessage("Грешка: " + e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Grant/revoke */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Задай роля по имейл</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1 flex-1 min-w-48">
            <Label className="t-small">Имейл</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label className="t-small">Роля</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin" | "it")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="it">it</SelectItem>
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

      {/* Current admins / IT */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-3">
        <h2 className="t-subheading font-semibold">Потребители с роля</h2>
        <div className="space-y-2">
          {users.filter((u) => u.role !== "user").map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <div className="t-body font-medium">{u.name ?? "—"}</div>
                <div className="t-small text-muted-foreground">{u.email}</div>
              </div>
              <Badge className={cn(
                u.role === "it" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
              )}>
                {u.role}
              </Badge>
            </div>
          ))}
          {users.filter((u) => u.role !== "user").length === 0 && (
            <p className="t-body text-muted-foreground text-center py-4">Няма потребители с специална роля.</p>
          )}
        </div>
      </div>
    </div>
  );
}
