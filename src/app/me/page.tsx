import { requireAuth } from "@/lib/auth-helpers";
import db from "@/db";
import { conversations, bots, analyses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { abandonStaleSimulations } from "@/lib/conversations";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, BarChart2, Clock, Dumbbell } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("bg", { day: "numeric", month: "short", year: "numeric" });
}

export default async function MePage() {
  const user = await requireAuth();

  // Cheap DB-only cleanup: mark long-idle "active" simulations as abandoned
  // before listing them. Intentionally does NOT run LLM analysis.
  await abandonStaleSimulations(user.id);

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      kind: conversations.kind,
      status: conversations.status,
      startedAt: conversations.startedAt,
      lastActivityAt: conversations.lastActivityAt,
      botTitle: bots.title,
      botKey: bots.key,
      overallScore: analyses.overallScore,
    })
    .from(conversations)
    .leftJoin(bots, eq(conversations.botId, bots.id))
    .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
    .where(eq(conversations.userId, user.id))
    .orderBy(desc(conversations.lastActivityAt))
    .limit(50);

  const simulations = rows.filter((r) => r.kind === "simulation");
  const chats = rows.filter((r) => r.kind === "consultant");

  const avgScore =
    simulations.filter((s) => s.overallScore != null).length > 0
      ? simulations.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) /
        simulations.filter((s) => s.overallScore != null).length
      : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="t-heading font-bold text-foreground">
              Здравей, {user.name ?? user.email}!
            </h1>
            <p className="t-body text-muted-foreground mt-1">Твоят обучителен напредък</p>
          </div>
          <Link
            href="/"
            className={cn(buttonVariants({ size: "sm" }), "shrink-0 bg-primary text-white hover:bg-primary/90")}
          >
            Към навигатора
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Симулации", value: simulations.length, icon: Dumbbell },
            { label: "Разговори с Роби", value: chats.length, icon: MessageSquare },
            { label: "Анализирани", value: simulations.filter((s) => s.overallScore != null).length, icon: BarChart2 },
            { label: "Средна оценка", value: avgScore ? `${avgScore.toFixed(1)}/10` : "—", icon: Clock },
          ].map((stat) => (
            <Card key={stat.label} className="bg-white">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <stat.icon className="h-4 w-4" />
                  <span className="t-small">{stat.label}</span>
                </div>
                <div className="t-heading font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Simulations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="t-subheading font-semibold">Симулации</h2>
          </div>

          {simulations.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="py-8 text-center text-muted-foreground t-body">
                Нямаш завършени симулации. Отиди на сценарий и натисни &quot;Тренирай&quot;.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {simulations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/me/conversations/${conv.id}`}
                  className="block"
                >
                  <Card className="bg-white hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="t-body font-medium text-foreground truncate">
                              {conv.botTitle ?? conv.title}
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                conv.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : conv.status === "active"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {conv.status === "completed"
                                ? "Завършена"
                                : conv.status === "active"
                                ? "Активна"
                                : "Изоставена"}
                            </Badge>
                          </div>
                          <p className="t-small text-muted-foreground mt-0.5">
                            {formatDate(conv.startedAt)}
                          </p>
                        </div>
                        {conv.overallScore != null && (
                          <div
                            className={cn(
                              "shrink-0 font-bold text-lg",
                              conv.overallScore >= 8
                                ? "text-green-600"
                                : conv.overallScore >= 6
                                ? "text-yellow-600"
                                : "text-red-600"
                            )}
                          >
                            {conv.overallScore.toFixed(1)}
                            <span className="text-sm font-normal text-muted-foreground">/10</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Consultant chats */}
        {chats.length > 0 && (
          <div className="space-y-3">
            <h2 className="t-subheading font-semibold">Разговори с Роби</h2>
            <div className="space-y-2">
              {chats.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/me/conversations/${conv.id}`}
                  className="block"
                >
                  <Card className="bg-white hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <span className="t-body font-medium">{conv.title ?? "Разговор с Роби"}</span>
                        <span className="t-small text-muted-foreground">{formatDate(conv.startedAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
