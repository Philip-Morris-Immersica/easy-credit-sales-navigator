"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Mail, Lock, User } from "lucide-react";
import { registerUser } from "@/lib/auth-actions";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Паролите не съвпадат.");
      return;
    }
    if (password.length < 8) {
      setError("Паролата трябва да е поне 8 символа.");
      return;
    }
    setLoading(true);
    const result = await registerUser(email, password, name);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    // Auto-login
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else {
      router.push("/login");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <Image src="/logos/easycredit-red.png" alt="EasyCredit" width={120} height={40} className="mx-auto h-8 w-auto object-contain" />
          <h1 className="t-heading font-bold text-foreground">Регистрация</h1>
          <p className="t-body text-muted-foreground">Създайте акаунт</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="t-body font-medium">Имена</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="name" placeholder="Ваши имена" value={name} onChange={(e) => setName(e.target.value)} className="pl-9" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="t-body font-medium">Имейл</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="t-body font-medium">Парола</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="new-password" placeholder="Мин. 8 символа" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="t-body font-medium">Потвърди паролата</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="confirm" type="password" autoComplete="new-password" placeholder="Повтори паролата" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-9" required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Регистрация…" : "Регистрирай се"}
          </Button>
        </form>

        <p className="text-center t-small text-muted-foreground">
          Вече имате акаунт?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">Вход</Link>
        </p>
      </div>
    </div>
  );
}
