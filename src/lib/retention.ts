import { sql } from "drizzle-orm";
import db from "@/db";
import { auditLog } from "@/db/schema";
import { APP_TIMEZONE } from "@/lib/date-range";

/**
 * Срок на съхранение на разговорите (Т6, Р-03) — ЕДИНСТВЕНОТО място, където се
 * сменя. Срокът тече за всеки разговор поотделно от `conversations.started_at`.
 */
export const RETENTION_MONTHS = 12;

/** Колко разговора се трият наведнъж (една SQL заявка = една партида). */
export const RETENTION_BATCH_SIZE = 100;

/** Горна граница на партиди за едно пускане (лимит на времето на функцията). */
export const RETENTION_MAX_BATCHES = 20;

/** Разговори със `startedAt` преди този момент подлежат на изтриване. */
export function retentionCutoff(now: Date = new Date()): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - RETENTION_MONTHS);
  return d;
}

export interface RetentionCounts {
  conversations: number;
  messages: number;
  analyses: number;
  /** Сума на разходите на съобщенията, които ще преминат в cost_rollups. */
  cost: number;
}

/** Дали миграцията 0001_cost_rollups е приложена. */
export async function costRollupsTableExists(): Promise<boolean> {
  const res = await db.execute(
    sql`SELECT to_regclass('public.cost_rollups') IS NOT NULL AS ok`
  );
  return Boolean((res.rows[0] as { ok?: boolean } | undefined)?.ok);
}

/**
 * Преглед (БЕЗ да трие): колко би се изтрило при дадена граница. Връща и
 * най-стария/най-новия `startedAt` сред подлежащите, без други данни.
 */
export async function previewRetention(cutoff: Date): Promise<
  RetentionCounts & { oldest: Date | null; newest: Date | null }
> {
  const iso = cutoff.toISOString();
  const res = await db.execute(sql`
    WITH old AS (
      SELECT id, started_at FROM conversations WHERE started_at < ${iso}::timestamp
    )
    SELECT
      (SELECT count(*) FROM old)::int AS conversations,
      (SELECT count(*) FROM messages m WHERE m.conversation_id IN (SELECT id FROM old))::int AS messages,
      (SELECT count(*) FROM analyses a WHERE a.conversation_id IN (SELECT id FROM old))::int AS analyses,
      (SELECT COALESCE(sum(m.cost), 0) FROM messages m WHERE m.conversation_id IN (SELECT id FROM old))::float8 AS cost,
      (SELECT min(started_at) FROM old) AS oldest,
      (SELECT max(started_at) FROM old) AS newest
  `);
  const r = res.rows[0] as {
    conversations: number;
    messages: number;
    analyses: number;
    cost: number;
    oldest: string | Date | null;
    newest: string | Date | null;
  };
  const toDate = (v: string | Date | null) =>
    v == null ? null : v instanceof Date ? v : new Date(String(v).replace(" ", "T") + "Z");
  return {
    conversations: r.conversations,
    messages: r.messages,
    analyses: r.analyses,
    cost: r.cost,
    oldest: toDate(r.oldest),
    newest: toDate(r.newest),
  };
}

/**
 * Една партида: в ЕДНА SQL заявка (атомарно — или всичко, или нищо)
 *  1. избира до `limit` най-стари разговори преди границата;
 *  2. сумира разходите на съобщенията им в cost_rollups (по ден/потребител/модел);
 *  3. трие разговорите — каскадата маха съобщенията и анализите.
 */
export function purgeBatchQuery(cutoff: Date, limit: number) {
  const iso = cutoff.toISOString();
  return sql`
    WITH batch AS (
      SELECT id FROM conversations
      WHERE started_at < ${iso}::timestamp
      ORDER BY started_at
      LIMIT ${limit}
    ),
    agg AS (
      SELECT
        (m.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TIMEZONE})::date AS day,
        c.user_id AS user_id,
        COALESCE(m.model, '') AS model,
        count(*)::int AS msgs,
        COALESCE(sum(m.tokens_in), 0)::bigint AS tokens_in,
        COALESCE(sum(m.tokens_out), 0)::bigint AS tokens_out,
        COALESCE(sum(m.cost), 0)::float8 AS cost
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.id IN (SELECT id FROM batch)
      GROUP BY 1, 2, 3
    ),
    ins AS (
      INSERT INTO cost_rollups (day, user_id, model, messages, tokens_in, tokens_out, cost)
      SELECT day, user_id, model, msgs, tokens_in, tokens_out, cost FROM agg
      ON CONFLICT (day, user_id, model) DO UPDATE SET
        messages   = cost_rollups.messages   + EXCLUDED.messages,
        tokens_in  = cost_rollups.tokens_in  + EXCLUDED.tokens_in,
        tokens_out = cost_rollups.tokens_out + EXCLUDED.tokens_out,
        cost       = cost_rollups.cost       + EXCLUDED.cost,
        updated_at = now()
      RETURNING 1
    ),
    del AS (
      DELETE FROM conversations WHERE id IN (SELECT id FROM batch) RETURNING id
    )
    SELECT
      (SELECT count(*) FROM del)::int AS conversations,
      (SELECT COALESCE(sum(msgs), 0) FROM agg)::int AS messages,
      (SELECT count(*) FROM analyses WHERE conversation_id IN (SELECT id FROM batch))::int AS analyses,
      (SELECT COALESCE(sum(cost), 0) FROM agg)::float8 AS cost,
      (SELECT count(*) FROM ins)::int AS rollup_rows
  `;
}

async function purgeBatch(cutoff: Date, limit: number): Promise<RetentionCounts> {
  const res = await db.execute(purgeBatchQuery(cutoff, limit));
  const r = res.rows[0] as unknown as RetentionCounts;
  return {
    conversations: r.conversations,
    messages: r.messages,
    analyses: r.analyses,
    cost: r.cost,
  };
}

export interface RetentionRunResult extends RetentionCounts {
  skipped: boolean;
  reason?: string;
  batches: number;
  /** Остават още подлежащи (удряме лимита на партиди; ще се довърши утре). */
  more: boolean;
}

/**
 * Пуска се от cron-а. Не трие нищо, докато таблицата cost_rollups не съществува
 * (иначе разходите за изтритите разговори биха изчезнали от справките).
 * Пише ЕДИН запис в журнала за пускане — само броячи, без лични данни.
 */
export async function runRetention(now: Date = new Date()): Promise<RetentionRunResult> {
  const empty: RetentionRunResult = {
    skipped: false,
    conversations: 0,
    messages: 0,
    analyses: 0,
    cost: 0,
    batches: 0,
    more: false,
  };

  if (!(await costRollupsTableExists())) {
    console.warn(
      "[retention] Пропуснато: липсва таблицата cost_rollups (миграция 0001 не е приложена)."
    );
    return { ...empty, skipped: true, reason: "cost_rollups table missing" };
  }

  const cutoff = retentionCutoff(now);
  const total = { ...empty };
  for (let i = 0; i < RETENTION_MAX_BATCHES; i++) {
    const part = await purgeBatch(cutoff, RETENTION_BATCH_SIZE);
    total.batches++;
    total.conversations += part.conversations;
    total.messages += part.messages;
    total.analyses += part.analyses;
    total.cost += part.cost;
    if (part.conversations < RETENTION_BATCH_SIZE) break;
    if (i === RETENTION_MAX_BATCHES - 1) total.more = true;
  }

  await db.insert(auditLog).values({
    actorId: null,
    action: "retention.purge",
    target: null,
    meta: {
      retentionMonths: RETENTION_MONTHS,
      cutoff: cutoff.toISOString(),
      conversations: total.conversations,
      messages: total.messages,
      analyses: total.analyses,
      batches: total.batches,
      more: total.more,
    },
  });

  return total;
}
