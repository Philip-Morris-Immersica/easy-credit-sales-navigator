"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Mail, Lock } from "lucide-react";
import { diagnoseLoginFailure, getEnabledOAuthProviders } from "@/lib/auth-actions";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<{ google: boolean; microsoft: boolean }>({
    google: false,
    microsoft: false,
  });

  // Surface OAuth callback errors (Auth.js redirects here with ?error=...).
  useEffect(() => {
    if (params.get("error")) {
      setError("Входът чрез външен доставчик е неуспешен. Опитайте отново.");
    }
  }, [params]);

  // Only show OAuth buttons that are actually configured on the server.
  useEffect(() => {
    getEnabledOAuthProviders().then(setProviders).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Diagnose first so we can always show a specific, reliable message —
    // independent of how Auth.js shapes its failure result.
    const { reason } = await diagnoseLoginFailure(email, password);
    if (reason !== "unknown") {
      setLoading(false);
      switch (reason) {
        case "no-user":
          setError("Няма регистриран потребител с този имейл.");
          break;
        case "bad-password":
          setError("Грешна парола.");
          break;
        case "oauth-only":
          setError(
            "Този акаунт е създаден чрез Google или Microsoft. Влезте със съответния бутон по-долу."
          );
          break;
        case "deactivated":
          setError("Този акаунт е деактивиран. Свържете се с администратор.");
          break;
      }
      return;
    }

    // Credentials are valid — establish the session.
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok && !res.error) {
      router.push(callbackUrl);
      router.refresh();
    } else {
      setError("Входът е неуспешен. Опитайте отново.");
    }
  }

  async function handleOAuth(provider: "google" | "microsoft-entra-id") {
    await signIn(provider, { callbackUrl });
  }

  const hasOAuth = providers.google || providers.microsoft;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <Image src="/logos/easycredit-red.png" alt="EasyCredit" width={120} height={40} className="mx-auto h-8 w-auto object-contain" />
          <h1 className="t-heading font-bold text-foreground">Вход</h1>
          <p className="t-body text-muted-foreground">Навигатор за продажбени умения</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="t-body font-medium">Имейл</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="t-body font-medium">Парола</Label>
              <Link href="/forgot-password" className="t-small text-primary hover:underline">
                Забравена парола?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Влизане…" : "Вход"}
          </Button>
        </form>

        {hasOAuth && (
          <>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 bg-white px-2 t-small text-muted-foreground">
                или
              </span>
            </div>

            <div className="space-y-2">
              {providers.google && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleOAuth("google")}
                  type="button"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Продължи с Google
                </Button>
              )}
              {providers.microsoft && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleOAuth("microsoft-entra-id")}
                  type="button"
                >
                  <svg className="h-4 w-4" viewBox="0 0 21 21" fill="none">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                  Продължи с Microsoft
                </Button>
              )}
            </div>
          </>
        )}

        <p className="text-center t-small text-muted-foreground">
          Нямате акаунт?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Регистрирайте се
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
