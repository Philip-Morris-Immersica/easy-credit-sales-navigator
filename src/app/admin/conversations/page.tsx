import { requireAdmin } from "@/lib/auth-helpers";
import { auth } from "@/auth";
import db from "@/db";
import { conversations, users, bots, analyses, messages } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { ConversationsClient } from "@/components/admin/ConversationsClient";

export default async function AdminConversationsPage() {
  await requireAdmin();
  const session = await auth();
  const isIT = session?.user?.role === "it";

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      kind: conversations.kind,
      status: conversations.status,
      startedAt: conversations.startedAt,
      lastActivityAt: conversations.lastActivityAt,
      userName: users.name,
      userEmail: users.email,
      botTitle: bots.title,
      overallScore: analyses.overallScore,
      msgCount: count(messages.id),
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.userId, users.id))
    .leftJoin(bots, eq(conversations.botId, bots.id))
    .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .groupBy(
      conversations.id, conversations.title, conversations.kind, conversations.status,
      conversations.startedAt, conversations.lastActivityAt,
      users.name, users.email, bots.title, analyses.overallScore
    )
    .orderBy(desc(conversations.lastActivityAt))
    .limit(200);

  const totalConvs = rows.length;
  const uniqueUsers = new Set(rows.map((r) => r.userEmail).filter(Boolean)).size;
  const withAnalysis = rows.filter((r) => r.overallScore != null).length;
  const avgMessages = totalConvs > 0
    ? (rows.reduce((s, r) => s + r.msgCount, 0) / totalConvs).toFixed(1)
    : "0";
  const analysisPercent = totalConvs > 0
    ? Math.round((withAnalysis / totalConvs) * 100)
    : 0;

  return (
    <ConversationsClient
      rows={rows}
      isIT={isIT}
      stats={{ totalConvs, uniqueUsers, avgMessages, withAnalysis, analysisPercent }}
    />
  );
}
