import db from "@/db";
import { users, conversations, messages, bots, analyses } from "@/db/schema";
import { eq, gte, lte, and, count, sum, countDistinct } from "drizzle-orm";

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

    result.summary = {
      newUsers: newUsers.count,
      conversations: convCount.count,
      messages: msgStats.count,
      totalCost: parseFloat(msgStats.totalCost ?? "0"),
    };
  }

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
      .having(count(conversations.id));

    // Get message counts per user
    result.activeUsers = rows
      .filter((r) => r.conversations > 0)
      .sort((a, b) => b.conversations - a.conversations)
      .map((r, i) => ({
        name: anonymize ? `User #${i + 1}` : (r.name ?? "—"),
        email: anonymize ? `user${i + 1}@anonymized` : r.email,
        conversations: r.conversations,
        messages: 0,
        cost: 0,
      }));
  }

  if (opts.includes.includes("languageBreakdown")) {
    const rows = await db
      .select({
        language: conversations.language,
        conversations: count(conversations.id),
      })
      .from(conversations)
      .where(and(gte(conversations.startedAt, fromDate), lte(conversations.startedAt, toDate)))
      .groupBy(conversations.language);

    result.languageBreakdown = rows.map((r) => ({
      language: r.language.toUpperCase(),
      conversations: r.conversations,
      messages: 0,
      cost: 0,
    }));
  }

  if (opts.includes.includes("modelBreakdown")) {
    const rows = await db
      .select({
        model: messages.model,
        messages: count(messages.id),
        tokensIn: sum(messages.tokensIn),
        tokensOut: sum(messages.tokensOut),
        cost: sum(messages.cost),
      })
      .from(messages)
      .where(and(gte(messages.createdAt, fromDate), lte(messages.createdAt, toDate)))
      .groupBy(messages.model);

    result.modelBreakdown = rows
      .filter((r) => r.model)
      .map((r) => ({
        model: r.model!,
        messages: r.messages,
        tokensIn: parseInt(r.tokensIn ?? "0"),
        tokensOut: parseInt(r.tokensOut ?? "0"),
        cost: parseFloat(r.cost ?? "0"),
      }));
  }

  return result;
}
