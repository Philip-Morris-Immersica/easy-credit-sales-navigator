/**
 * Т6: показва какво БИ изтрил cron-ът за автоматично изтриване — НИЩО не трие
 * и не пише (само SELECT-и).
 *
 * Пускане:
 *   npx tsx scripts/retention-dry-run.ts                 # текущият срок (RETENTION_MONTHS)
 *   npx tsx scripts/retention-dry-run.ts --days 1        # всичко по-старо от 1 ден
 *   npx tsx scripts/retention-dry-run.ts --months 6
 */
import "dotenv/config";
import {
  RETENTION_MONTHS,
  retentionCutoff,
  previewRetention,
  costRollupsTableExists,
} from "../src/lib/retention";

function arg(name: string): number | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = Number(process.argv[i + 1]);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`--${name} иска положително число`);
  }
  return v;
}

async function main() {
  const days = arg("days");
  const months = arg("months");
  const now = new Date();
  let cutoff: Date;
  let label: string;
  if (days != null) {
    cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    label = `${days} дни`;
  } else if (months != null) {
    cutoff = new Date(now.getTime());
    cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
    label = `${months} месеца`;
  } else {
    cutoff = retentionCutoff(now);
    label = `${RETENTION_MONTHS} месеца (настоящ срок)`;
  }

  const p = await previewRetention(cutoff);
  const rollups = await costRollupsTableExists();

  console.log("DRY RUN — нищо не се изтрива.");
  console.log(`Срок:                     ${label}`);
  console.log(`Граница (startedAt <):    ${cutoff.toISOString()}`);
  console.log(`Разговори за изтриване:   ${p.conversations}`);
  console.log(`  съобщения (каскада):    ${p.messages}`);
  console.log(`  анализи (каскада):      ${p.analyses}`);
  console.log(`  разход, който се пази:  $${p.cost.toFixed(6)} (преминава в cost_rollups)`);
  if (p.oldest && p.newest) {
    console.log(`  най-стар / най-нов:     ${p.oldest.toISOString()} / ${p.newest.toISOString()}`);
  }
  console.log(
    `Таблица cost_rollups:     ${rollups ? "налична" : "ЛИПСВА (миграция 0001 не е приложена) — cron-ът няма да трие"}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
