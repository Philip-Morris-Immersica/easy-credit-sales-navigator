import { and, eq, gte, lte, sum } from "drizzle-orm";
import db from "@/db";
import { costRollups, users } from "@/db/schema";

/**
 * Четене на обобщените разходи на изтритите (след 12 месеца) разговори (Т6).
 * Справките за разходите = живите съобщения + тези редове, така че цифрите за
 * минали периоди не се променят след изтриването. Всички функции приемат дни
 * във вид `yyyy-MM-dd` (календарен ден по Europe/Sofia).
 *
 * Докато миграция 0001 не е приложена (таблицата липсва), връщат празен
 * резултат вместо да чупят страниците.
 */

function isMissingTable(e: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = e;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const o = cur as { code?: string; message?: string; cause?: unknown };
    if (o.code === "42P01") return true;
    if (o.message?.includes("cost_rollups") && o.message.includes("does not exist"))
      return true;
    cur = o.cause;
  }
  return false;
}

async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isMissingTable(e)) return fallback;
    throw e;
  }
}

const inRange = (from: string, to: string) =>
  and(gte(costRollups.day, from), lte(costRollups.day, to));

const n = (v: unknown) => Number(v ?? 0);

export interface RollupTotals {
  cost: number;
  tokensIn: number;
  tokensOut: number;
  messages: number;
}

export async function rollupTotals(from: string, to: string): Promise<RollupTotals> {
  return safe({ cost: 0, tokensIn: 0, tokensOut: 0, messages: 0 }, async () => {
    const [r] = await db
      .select({
        cost: sum(costRollups.cost),
        tokensIn: sum(costRollups.tokensIn),
        tokensOut: sum(costRollups.tokensOut),
        messages: sum(costRollups.messages),
      })
      .from(costRollups)
      .where(inRange(from, to));
    return {
      cost: n(r?.cost),
      tokensIn: n(r?.tokensIn),
      tokensOut: n(r?.tokensOut),
      messages: n(r?.messages),
    };
  });
}

export async function rollupByModel(from: string, to: string) {
  return safe(
    [] as { model: string; messages: number; tokensIn: number; tokensOut: number; cost: number }[],
    async () => {
      const rows = await db
        .select({
          model: costRollups.model,
          messages: sum(costRollups.messages),
          tokensIn: sum(costRollups.tokensIn),
          tokensOut: sum(costRollups.tokensOut),
          cost: sum(costRollups.cost),
        })
        .from(costRollups)
        .where(inRange(from, to))
        .groupBy(costRollups.model);
      return rows.map((r) => ({
        model: r.model,
        messages: n(r.messages),
        tokensIn: n(r.tokensIn),
        tokensOut: n(r.tokensOut),
        cost: n(r.cost),
      }));
    }
  );
}

export async function rollupByUser(from: string, to: string) {
  return safe(
    [] as { userId: string | null; name: string | null; email: string | null; cost: number }[],
    async () => {
      const rows = await db
        .select({
          userId: costRollups.userId,
          name: users.name,
          email: users.email,
          cost: sum(costRollups.cost),
        })
        .from(costRollups)
        .leftJoin(users, eq(costRollups.userId, users.id))
        .where(inRange(from, to))
        .groupBy(costRollups.userId, users.name, users.email);
      return rows.map((r) => ({ ...r, cost: n(r.cost) }));
    }
  );
}

/** Разход и входни токени по ден (ключ `yyyy-MM-dd`). */
export async function rollupByDay(from: string, to: string) {
  return safe(new Map<string, { cost: number; tokens: number }>(), async () => {
    const rows = await db
      .select({
        day: costRollups.day,
        cost: sum(costRollups.cost),
        tokens: sum(costRollups.tokensIn),
      })
      .from(costRollups)
      .where(inRange(from, to))
      .groupBy(costRollups.day);
    return new Map(rows.map((r) => [r.day, { cost: n(r.cost), tokens: n(r.tokens) }]));
  });
}

/** Общо за един потребител (за всички времена). */
export async function rollupUserTotal(userId: string): Promise<RollupTotals> {
  return safe({ cost: 0, tokensIn: 0, tokensOut: 0, messages: 0 }, async () => {
    const [r] = await db
      .select({
        cost: sum(costRollups.cost),
        tokensIn: sum(costRollups.tokensIn),
        tokensOut: sum(costRollups.tokensOut),
        messages: sum(costRollups.messages),
      })
      .from(costRollups)
      .where(eq(costRollups.userId, userId));
    return {
      cost: n(r?.cost),
      tokensIn: n(r?.tokensIn),
      tokensOut: n(r?.tokensOut),
      messages: n(r?.messages),
    };
  });
}
