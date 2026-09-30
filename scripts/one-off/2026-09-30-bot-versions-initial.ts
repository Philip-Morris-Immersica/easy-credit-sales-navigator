// Еднократно (Ф1, задача 1.8): записва текущото състояние на ВСИЧКИ ботове
// като първа версия в bot_versions. Само чете `bots` и вмъква в `bot_versions`;
// не променя нищо друго. Безопасно е да се пусне повторно (не дублира).
//
// Пускане: npx tsx scripts/one-off/2026-09-30-bot-versions-initial.ts
import "dotenv/config";
import db from "../../src/db";
import { bots } from "../../src/db/schema";
import { snapshotBot } from "../../src/lib/bot-versions";

async function main() {
  const all = await db.select().from(bots);
  for (const bot of all) {
    const created = await snapshotBot(bot, null, "initial");
    console.log(`${created ? "записан " : "пропуснат"}  ${bot.key}`);
  }
  console.log(`Общо ботове: ${all.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
