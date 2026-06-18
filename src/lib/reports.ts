import db from "@/db";
import { users, conversations, messages, bots, analyses } from "@/db/schema";
import { eq, gte, lte, and, count, sum, gt, asc } from "drizzle-orm";

export interface ReportOptions {
  from: string;
  to: string;
  includes: string[];
}

export async function generateReportData(opts: ReportOptions) {
  const fromDate = new Date(opts.from);
  const toDate = new Date(opts.to);
  toDate.setHours(23, 59, 59, 999);
  const anonymize = opts.includes.includes("anonymize");

  const result: Record<string, unknown> = {};

  // ── Summary ──────────────────────────────────────────────────────────────────
  if (opts.includes.includes("summary")) {
    const [newUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(and(gte(users.createdAt, fromDate), lte(users.createdAt, toDate)));

    const [convCount] = await db
      .select({ count: count() })
      .from(conversations)
      .where(and(gte(conversations.startedAt, fromDate), lte(conversations.startedAt, toDate)));

    const [msgStats] = await db
      .select({ count: count(), totalCost: sum(messages.cost) })
      .from(messages)
      .where(and(gte(messages.createdAt, fromDate), lte(messages.createdAt, toDate)));

    const [analysisCount] = await db
      .select({ count: count() })
      .from(analyses)
      .where(and(gte(analyses.createdAt, fromDate), lte(analyses.createdAt, toDate)));

    result.summary = {
      newUsers: newUsers.count,
      conversations: convCount.count,
      messages: msgStats.count,
      analyses: analysisCount.count,
      totalCost: parseFloat(msgStats.totalCost ?? "0"),
    };
  }

  // ── Active Users with costs ───────────────────────────────────────────────
  if (opts.includes.includes("activeUsers")) {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        conversations: count(conversations.id),
      })
      .from(users)
      .leftJoin(
        conversations,
        and(
          eq(conversations.userId, users.id),
          gte(conversations.startedAt, fromDate),
          lte(conversations.startedAt, toDate)
        )
      )
      .groupBy(users.id, users.name, users.email)
      .having(gt(count(conversations.id), 0));

    // Fetch costs per user via messages
    const costRows = await db
      .select({
        userId: conversations.userId,
        totalCost: sum(messages.cost),
        totalMessages: count(messages.id),
        tokensIn: sum(messages.tokensIn),
        tokensOut: sum(messages.tokensOut),
      })
      .from(messages)
      .leftJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(gte(messages.createdAt, fromDate), lte(messages.createdAt, toDate)))
      .groupBy(conversations.userId);

    const costMap = new Map(costRows.map((r) => [r.userId, r]));

    result.activeUsers = rows
      .filter((r) => r.conversations > 0)
      .sort((a, b) => b.conversations - a.conversations)
      .map((r, i) => {
        const costs = costMap.get(r.id);
        return {
          name: anonymize ? `User #${i + 1}` : (r.name ?? "—"),
          email: anonymize ? `user${i + 1}@anonymized` : r.email,
          conversations: r.conversations,
          messages: costs?.totalMessages ?? 0,
          tokensIn: parseInt(String(costs?.tokensIn ?? "0")),
          tokensOut: parseInt(String(costs?.tokensOut ?? "0")),
          cost: parseFloat(String(costs?.totalCost ?? "0")),
        };
      });
  }

  // ── Analyses ──────────────────────────────────────────────────────────────
  if (opts.includes.includes("analyses")) {
    const rows = await db
      .select({
        id: analyses.id,
        conversationId: analyses.conversationId,
        overallScore: analyses.overallScore,
        summary: analyses.summary,
        strengths: analyses.strengths,
        improvements: analyses.improvements,
        createdAt: analyses.createdAt,
        userName: users.name,
        userEmail: users.email,
        botTitle: bots.title,
      })
      .from(analyses)
      .leftJoin(conversations, eq(analyses.conversationId, conversations.id))
      .leftJoin(users, eq(conversations.userId, users.id))
      .leftJoin(bots, eq(analyses.botId, bots.id))
      .where(and(gte(analyses.createdAt, fromDate), lte(analyses.createdAt, toDate)))
      .orderBy(asc(analyses.createdAt));

    result.analyses = rows.map((r, i) => ({
      user: anonymize ? `User #${i + 1}` : (r.userName ?? "—"),
      email: anonymize ? `user${i + 1}@anonymized` : (r.userEmail ?? "—"),
      bot: r.botTitle ?? "—",
      date: r.createdAt.toLocaleDateString("bg"),
      overallScore: r.overallScore ?? null,
      summary: r.summary ?? "",
      strengths: (r.strengths ?? []).join("; "),
      improvements: (r.improvements ?? []).join("; "),
      conversationId: r.conversationId,
    }));
  }

  // ── Transcripts ───────────────────────────────────────────────────────────
  if (opts.includes.includes("transcripts")) {
    const convRows = await db
      .select({
        id: conversations.id,
        startedAt: conversations.startedAt,
        status: conversations.status,
        userName: users.name,
        userEmail: users.email,
        botTitle: bots.title,
        overallScore: analyses.overallScore,
      })
      .from(conversations)
      .leftJoin(users, eq(conversations.userId, users.id))
      .leftJoin(bots, eq(conversations.botId, bots.id))
      .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
      .where(and(gte(conversations.startedAt, fromDate), lte(conversations.startedAt, toDate)));

    const transcripts: Array<{
      conversationId: string;
      user: string;
      email: string;
      bot: string;
      startedAt: string;
      status: string;
      overallScore: number | null;
      messages: Array<{ role: string; content: string }>;
    }> = [];

    for (const conv of convRows) {
      const msgs = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(asc(messages.createdAt));

      const userMsgs = msgs.filter((m) => m.role !== "system");
      if (userMsgs.length === 0) continue;

      transcripts.push({
        conversationId: conv.id,
        user: anonymize ? "Анонимен" : (conv.userName ?? "—"),
        email: anonymize ? "—" : (conv.userEmail ?? "—"),
        bot: conv.botTitle ?? "—",
        startedAt: conv.startedAt.toLocaleDateString("bg"),
        status: conv.status,
        overallScore: conv.overallScore ?? null,
        messages: userMsgs,
      });
    }

    result.transcripts = transcripts;
  }

  return result;
}
