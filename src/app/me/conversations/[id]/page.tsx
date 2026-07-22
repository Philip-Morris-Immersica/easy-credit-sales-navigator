import { requireAuth } from "@/lib/auth-helpers";
import db from "@/db";
import { conversations, messages, analyses, bots } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AnalysisFeedback } from "@/components/chat/AnalysisFeedback";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

function formatTime(d: Date) {
  return new Date(d).toLocaleString("bg", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Only allow internal `/admin...` paths as the back target — anything else
 *  (external URLs, protocol-relative `//evil.com`, etc.) falls back to `/me`
 *  to avoid an open redirect via the `from` query param. */
function resolveBackHref(from: string | undefined): string {
  if (from && from.startsWith("/admin") && !from.startsWith("//")) {
    return from;
  }
  return "/me";
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = resolveBackHref(from);

  const conv = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .then((r) => r[0]);

  if (!conv) notFound();

  const isAdminOrIT = user.role === "admin" || user.role === "it";
  if (conv.userId !== user.id && !isAdminOrIT) redirect("/me");

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const analysis = await db
    .select()
    .from(analyses)
    .where(eq(analyses.conversationId, id))
    .then((r) => r[0] ?? null);

  const bot = await db
    .select({ title: bots.title, welcomeMessage: bots.welcomeMessage })
    .from(bots)
    .where(eq(bots.id, conv.botId))
    .then((r) => r[0]);

  // Filter out system messages for transcript display
  const userMessages = msgs.filter((m) => m.role !== "system");

  // Prepend the bot's first reply (welcomeMessage) if it exists and isn't already in DB
  // The welcomeMessage is shown in the chat UI but not stored in the DB
  const hasStoredWelcome = userMessages.length > 0 && userMessages[0].role === "assistant";
  const firstReply = bot?.welcomeMessage?.trim() ?? "";
  const showWelcomeAsFirst = firstReply && !hasStoredWelcome;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="t-heading font-bold">{bot?.title ?? conv.title ?? "Разговор"}</h1>
            <p className="t-small text-muted-foreground">{formatTime(conv.startedAt)}</p>
          </div>
          <Badge className={cn(
            "ml-auto",
            conv.status === "completed" ? "bg-green-100 text-green-700" :
            conv.status === "active" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
          )}>
            {conv.status === "completed" ? "Завършена" : conv.status === "active" ? "Активна" : "Изоставена"}
          </Badge>
        </div>

        {/* Transcript — shown FIRST */}
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h2 className="t-subheading font-semibold">Транскрипт</h2>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {/* Show welcomeMessage as first assistant reply if not in DB */}
            {showWelcomeAsFirst && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-2.5 t-body bg-muted text-foreground rounded-bl-sm">
                  <div className="mb-0.5 text-xs opacity-60">Клиент</div>
                  {firstReply}
                </div>
              </div>
            )}

            {userMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 t-body",
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  <div className="mb-0.5 text-xs opacity-60">
                    {msg.role === "user" ? "Консултант" : "Клиент"}
                  </div>
                  {msg.content}
                </div>
              </div>
            ))}

            {userMessages.length === 0 && !showWelcomeAsFirst && (
              <p className="text-muted-foreground t-body text-center py-4">Няма съобщения.</p>
            )}
          </div>
        </div>

        {/* Analysis — shown AFTER transcript */}
        {analysis && (
          <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
            <h2 className="t-subheading font-semibold">Анализ</h2>
            <AnalysisFeedback
              analysis={{
                overallScore: analysis.overallScore ?? 0,
                criteria: (analysis.criteria as Array<{ name: string; score: number; comment: string }>) ?? [],
                strengths: analysis.strengths ?? [],
                improvements: analysis.improvements ?? [],
                summary: analysis.summary ?? "",
              }}
              conversationId={id}
              title={`Анализ — ${bot?.title ?? conv.title ?? "Разговор"}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
