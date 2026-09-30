import db from "@/db";
import { bots, botVersions, type Bot } from "@/db/schema";
import { and, desc, eq, notInArray } from "drizzle-orm";

/** Колко версии пазим на бот. */
export const MAX_BOT_VERSIONS = 10;

export type VersionReason = "initial" | "edit" | "restore" | "script";

/** Полетата на бота, които се версионират (и се възстановяват). */
const SNAPSHOT_FIELDS = [
  "systemPrompt",
  "analysisPrompt",
  "welcomeMessage",
  "model",
  "analysisModel",
  "temperature",
  "maxTokens",
  "analysisTemperature",
  "analysisMaxTokens",
  "enabled",
] as const;

type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];
export type BotSnapshot = Pick<Bot, SnapshotField>;

function pickSnapshot(src: BotSnapshot): BotSnapshot {
  return {
    systemPrompt: src.systemPrompt,
    analysisPrompt: src.analysisPrompt,
    welcomeMessage: src.welcomeMessage,
    model: src.model,
    analysisModel: src.analysisModel,
    temperature: src.temperature,
    maxTokens: src.maxTokens,
    analysisTemperature: src.analysisTemperature,
    analysisMaxTokens: src.analysisMaxTokens,
    enabled: src.enabled,
  };
}

function sameSnapshot(a: BotSnapshot, b: BotSnapshot): boolean {
  return SNAPSHOT_FIELDS.every((f) => (a[f] ?? null) === (b[f] ?? null));
}

/**
 * Записва ТЕКУЩОТО състояние на бота като версия (извиква се ПРЕДИ презапис)
 * и подрязва историята до последните MAX_BOT_VERSIONS.
 * Ако текущото състояние е идентично с последната версия — не дублира.
 * Връща true, ако е записана нова версия.
 */
export async function snapshotBot(
  bot: Bot,
  actorId: string | null,
  reason: VersionReason
): Promise<boolean> {
  const latest = await db
    .select()
    .from(botVersions)
    .where(eq(botVersions.botKey, bot.key))
    .orderBy(desc(botVersions.changedAt))
    .limit(1)
    .then((r) => r[0]);

  if (latest && sameSnapshot(pickSnapshot(latest), pickSnapshot(bot))) {
    return false;
  }

  await db.insert(botVersions).values({
    botKey: bot.key,
    ...pickSnapshot(bot),
    reason,
    changedBy: actorId,
  });

  // Подрязване: оставяме само най-новите MAX_BOT_VERSIONS.
  const keep = await db
    .select({ id: botVersions.id })
    .from(botVersions)
    .where(eq(botVersions.botKey, bot.key))
    .orderBy(desc(botVersions.changedAt))
    .limit(MAX_BOT_VERSIONS);

  await db.delete(botVersions).where(
    and(
      eq(botVersions.botKey, bot.key),
      notInArray(
        botVersions.id,
        keep.map((k) => k.id)
      )
    )
  );

  return true;
}

/** Връща полетата, които се записват обратно в `bots` при възстановяване. */
export function snapshotToBotUpdate(v: BotSnapshot) {
  return { ...pickSnapshot(v), updatedAt: new Date() };
}

export async function getBotByKey(key: string): Promise<Bot | undefined> {
  return db
    .select()
    .from(bots)
    .where(eq(bots.key, key))
    .then((r) => r[0]);
}
