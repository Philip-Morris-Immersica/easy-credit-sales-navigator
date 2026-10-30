import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

/**
 * Т8.3: обновява таблицата `model_pricing` (само показването на разходите).
 * Цени — https://developers.openai.com/api/docs/pricing (проверени 30.10.2026),
 * на 1M токена: gpt-5.4 $2.50/$15, gpt-5.4-mini $0.75/$4.50,
 * gpt-6-sol $2/$10, gpt-6-luna $0.10/$0.50. В базата се пази цена на 1k токена.
 * Маха се спрелият gpt-4.1-nano (23.10.2026) — само ако нито един бот не го ползва.
 *
 * Употреба:
 *   npx tsx scripts/update-model-pricing.ts --dry-run   # само показва
 *   npx tsx scripts/update-model-pricing.ts             # прилага
 */

const DRY_RUN = process.argv.includes("--dry-run");

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

const PRICES_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-5.4": { input: 2.5, output: 15 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-6-sol": { input: 2, output: 10 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
};
const REMOVE = ["gpt-4.1-nano"];

async function main() {
  console.log(DRY_RUN ? "== DRY RUN (нищо не се записва) ==" : "== ПРИЛАГАНЕ ==");
  const existing = await db.select().from(schema.modelPricing);
  const byModel = new Map(existing.map((r) => [r.model, r]));

  for (const [model, p] of Object.entries(PRICES_PER_1M)) {
    const inputPer1k = p.input / 1000;
    const outputPer1k = p.output / 1000;
    const cur = byModel.get(model);
    const status = !cur
      ? "ДОБАВЯ"
      : cur.inputPer1k === inputPer1k && cur.outputPer1k === outputPer1k
        ? "без промяна"
        : `ОБНОВЯВА (беше ${cur.inputPer1k}/${cur.outputPer1k})`;
    console.log(`${model}: ${inputPer1k} / ${outputPer1k} на 1k -> ${status}`);
    if (!DRY_RUN && status !== "без промяна") {
      await db
        .insert(schema.modelPricing)
        .values({ model, inputPer1k, outputPer1k })
        .onConflictDoUpdate({
          target: schema.modelPricing.model,
          set: { inputPer1k, outputPer1k },
        });
    }
  }

  const bots = await db.select().from(schema.bots);
  for (const model of REMOVE) {
    if (!byModel.has(model)) {
      console.log(`${model}: няма ред в model_pricing`);
      continue;
    }
    const usedBy = bots
      .filter((b) => b.model === model || b.analysisModel === model)
      .map((b) => b.key);
    if (usedBy.length > 0) {
      console.log(`${model}: НЕ се маха — ползван от ${usedBy.join(", ")}`);
      continue;
    }
    console.log(`${model}: ПРЕМАХВА (никой бот не го ползва)`);
    if (!DRY_RUN) {
      await db.delete(schema.modelPricing).where(eq(schema.modelPricing.model, model));
    }
  }

  console.log(
    "Модели на ботовете (не се променят): " +
      [...new Set(bots.flatMap((b) => [b.model, b.analysisModel ?? "(по подразб.)"]))].join(", ")
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
