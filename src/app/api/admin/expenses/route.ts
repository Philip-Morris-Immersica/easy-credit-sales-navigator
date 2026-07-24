import { auth } from "@/auth";
import db from "@/db";
import { messages, conversations, users } from "@/db/schema";
import { eq, gte, lte, and, count, sum } from "drizzle-orm";
import { zonedDayStart, zonedDayEnd, LAUNCH_ISO, todayIso } from "@/lib/date-range";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "it")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  // Interpret the picked days as Europe/Sofia calendar days (#A2.1).
  const fromDate = zonedDayStart(fromStr ?? LAUNCH_ISO);
  const toDate = zonedDayEnd(toStr ?? todayIso());

  // Total stats
  const [totals] = await db
    .select({
      totalCost: sum(messages.cost),
      totalTokensIn: sum(messages.tokensIn),
      totalTokensOut: sum(messages.tokensOut),
      totalMessages: count(messages.id),
    })
    .from(messages)
    .where(and(gte(messages.createdAt, fromDate), lte(messages.createdAt, toDate)));

  // Model breakdown
  const modelRows = await db
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

  const modelBreakdown = modelRows
    .filter((r) => r.model)
    .map((r) => ({
      model: r.model!,
      messages: r.messages,
      tokensIn: parseInt(String(r.tokensIn ?? "0")),
      tokensOut: parseInt(String(r.tokensOut ?? "0")),
      cost: parseFloat(String(r.cost ?? "0")),
    }))
    .sort((a, b) => b.cost - a.cost);

  // User breakdown (join conversations → messages)
  const userRows = await db
    .select({
      userId: conversations.userId,
      name: users.name,
      email: users.email,
      conversations: count(conversations.id),
      cost: sum(messages.cost),
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.userId, users.id))
    .leftJoin(
      messages,
      and(
        eq(messages.conversationId, conversations.id),
        gte(messages.createdAt, fromDate),
        lte(messages.createdAt, toDate)
      )
    )
    .where(and(gte(conversations.startedAt, fromDate), lte(conversations.startedAt, toDate)))
    .groupBy(conversations.userId, users.name, users.email);

  const userBreakdown = userRows
    .map((r) => ({
      name: r.name ?? "—",
      email: r.email ?? "—",
      conversations: r.conversations,
      cost: parseFloat(String(r.cost ?? "0")),
    }))
    .filter((r) => r.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  // Daily costs (last N days in range)
  const days: { date: string; cost: number; tokens: number }[] = [];
  const startDay = new Date(fromDate);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(toDate);
  endDay.setHours(0, 0, 0, 0);
  const diffMs = endDay.getTime() - startDay.getTime();
  const diffDays = Math.min(Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1, 60);

  for (let i = diffDays - 1; i >= 0; i--) {
    const d = new Date(endDay);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const [res] = await db
      .select({ cost: sum(messages.cost), tokens: sum(messages.tokensIn) })
      .from(messages)
      .where(and(gte(messages.createdAt, d), lte(messages.createdAt, next)));

    days.push({
      date: d.toLocaleDateString("bg", { day: "numeric", month: "short" }),
      cost: parseFloat(String(res?.cost ?? "0")),
      tokens: parseInt(String(res?.tokens ?? "0")),
    });
  }

  return Response.json({
    totalCost: parseFloat(String(totals.totalCost ?? "0")),
    totalTokensIn: parseInt(String(totals.totalTokensIn ?? "0")),
    totalTokensOut: parseInt(String(totals.totalTokensOut ?? "0")),
    totalMessages: totals.totalMessages,
    modelBreakdown,
    userBreakdown,
    dailyCosts: days,
  });
}
