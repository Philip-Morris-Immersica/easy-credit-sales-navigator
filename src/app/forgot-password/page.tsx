"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import { sendPasswordReset } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    await sendPasswordReset(email);
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <Image src="/logos/easycredit-red.png" alt="EasyCredit" width={120} height={40} className="mx-auto h-8 w-auto object-contain" />
          <h1 className="t-heading font-bold text-foreground">Забравена парола</h1>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <p className="t-body text-foreground">
              Ако имейл адресът съществува в системата, ще получите линк за нулиране на паролата.
            </p>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}>
              Назад към вход
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <p className="t-body text-muted-foreground">
              Въведете имейла си и ще ви изпратим линк за нулиране на паролата.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="t-body font-medium">Имейл</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Изпращане…" : "Изпрати линк"}
              </Button>
            </form>
            <p className="text-center t-small text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">Назад към вход</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
