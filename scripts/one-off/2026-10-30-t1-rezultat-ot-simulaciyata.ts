// Т1 (кръг IV): шестият критерий „Продажбен резултат" -> „Резултат от симулацията".
//  1) analysisPrompt на 9-те симулационни бота: новото име в JSON образеца + ред, който го фиксира
//     (за да върне моделът точно новото име). Преди запис — снимка в bot_versions (reason: script).
//  2) analyses.criteria и analyses.raw_json (jsonb): преименуване на критерия в съществуващите анализи.
// НЕ пипа systemPrompt. Идемпотентен: втори пуск не намира нищо за промяна.
//
// Пускане:  npx tsx scripts/one-off/2026-10-30-t1-rezultat-ot-simulaciyata.ts --dry-run   (само печата)
//           npx tsx scripts/one-off/2026-10-30-t1-rezultat-ot-simulaciyata.ts             (запис)
import "dotenv/config";
import { eq, isNotNull } from "drizzle-orm";
import db from "../../src/db";
import { bots, analyses } from "../../src/db/schema";
import { snapshotBot } from "../../src/lib/bot-versions";

const DRY = process.argv.includes("--dry-run") || process.argv.includes("--dry");
const OLD = "Продажбен резултат";
const NEW = "Резултат от симулацията";

const NAME_NOTE =
  `ШЕСТИ КРИТЕРИЙ: името му е точно „${NEW}“ — оценява докъде разговорът реално е придвижил клиента към следваща стъпка. ` +
  `Връщай го с това име във всеки анализ; ако в рамката по-долу е наречен по друг начин, това е същият критерий и името остава „${NEW}“.\n\n`;

function transformPrompt(key: string, prompt: string): string {
  let p = prompt;
  const occurrences = p.split(OLD).length - 1;
  if (occurrences !== 1) throw new Error(`${key}: очаквах 1 „${OLD}“, има ${occurrences}`);
  p = p.replace(`"name": "${OLD}"`, `"name": "${NEW}"`);
  if (p.includes(OLD)) throw new Error(`${key}: „${OLD}“ не е в очаквания JSON ред`);
  if (!p.includes(NAME_NOTE)) {
    const marker = "Върни САМО валиден JSON";
    const idx = p.indexOf(marker);
    if (idx < 0 || p.indexOf(marker, idx + 1) >= 0) throw new Error(`${key}: не намирам еднозначно „${marker}“`);
    p = p.slice(0, idx) + NAME_NOTE + p.slice(idx);
  }
  return p;
}

function ctx(s: string, i: number) {
  return "…" + s.slice(Math.max(0, i - 50), i + 80).replace(/\s+/g, " ") + "…";
}

async function main() {
  // ── 1) промптове ───────────────────────────────────────────────────────────
  const allBots = await db.select().from(bots);
  let botsChanged = 0;
  for (const bot of allBots.sort((a, z) => a.key.localeCompare(z.key))) {
    const ap = bot.analysisPrompt ?? "";
    if (!ap.includes(OLD)) continue;
    const next = transformPrompt(bot.key, ap);
    botsChanged++;
    console.log(`BOT ${bot.key.padEnd(32)} AP ${ap.length} -> ${next.length} знака`);
    if (DRY) {
      const i = ap.indexOf(OLD);
      console.log("   - " + ctx(ap, i));
      const j = next.indexOf(NEW);
      console.log("   + " + ctx(next, j));
      continue;
    }
    await snapshotBot(bot, null, "script");
    await db.update(bots).set({ analysisPrompt: next, updatedAt: new Date() }).where(eq(bots.key, bot.key));
  }
  console.log(`Ботове за промяна: ${botsChanged}`);

  // ── 2) анализи ─────────────────────────────────────────────────────────────
  const rows = await db
    .select({ id: analyses.id, criteria: analyses.criteria, rawJson: analyses.rawJson })
    .from(analyses)
    .where(isNotNull(analyses.criteria));
  const re = new RegExp(OLD, "gi");
  let changed = 0;
  let nonNameHits = 0;
  for (const r of rows) {
    const cs = JSON.stringify(r.criteria);
    const rs = JSON.stringify(r.rawJson ?? null);
    if (!re.test(cs) && !re.test(rs)) continue;
    re.lastIndex = 0;
    // Преименуваме само полето name на критерия; други срещания (в коментари) само броим и показваме.
    const fix = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(fix);
      if (v && typeof v === "object") {
        const o = { ...(v as Record<string, unknown>) };
        if (o.name === OLD) o.name = NEW;
        for (const k of Object.keys(o)) o[k] = fix(o[k]);
        return o;
      }
      return v;
    };
    const newCriteria = fix(r.criteria);
    const newRaw = r.rawJson == null ? r.rawJson : fix(r.rawJson);
    const left = (JSON.stringify(newCriteria) + JSON.stringify(newRaw ?? null)).match(re);
    if (left) {
      nonNameHits += left.length;
      console.log(`   ! ${r.id}: останало „${OLD}“ извън полето name (${left.length})`);
    }
    changed++;
    if (!DRY) {
      await db
        .update(analyses)
        .set({ criteria: newCriteria as object, rawJson: newRaw as object | null })
        .where(eq(analyses.id, r.id));
    }
  }
  console.log(`Анализи за промяна: ${changed} от ${rows.length} (останали срещания извън name: ${nonNameHits})`);
  console.log(DRY ? "\nDRY RUN — нищо не е записано." : "\nЗаписано.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
