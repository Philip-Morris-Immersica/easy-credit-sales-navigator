// Т3 (кръг IV): сценарий „Среща – Нов клиент в офис" + език на анализите.
//  3.1/3.2  meeting-scenario-new:
//           - systemPrompt: ясно, че Ива е НОВ клиент (онлайн заявка, идва в офиса за условията на място);
//             „11 двуседмични периода" -> „11 двуседмични вноски" (5 места, вкл. „броя периоди").
//           - analysisPrompt: „нов клиент" във фокуса и „вноски" вместо „периоди".
//  3.3б/в   ВСИЧКИ 9 симулационни бота — в analysisPrompt (преди „Върни САМО валиден JSON") блок
//           „ЕЗИК И ТОЧНОСТ НА ТЕКСТА": правилен книжовен български, неутрално за консултанта,
//           пол на клиента, описване само на реално случилото се.
// Един запис и ЕДНА версия (bot_versions, reason: script) на бот. Не пипа src/lib/analysis.ts.
// Картата в tree.ts се редактира отделно (кодова промяна, не е в тази база).
//
// Пускане:  npx tsx scripts/one-off/2026-10-30-t3-meeting-new-i-ezik.ts --dry-run   (само печата)
//           npx tsx scripts/one-off/2026-10-30-t3-meeting-new-i-ezik.ts             (запис)
import "dotenv/config";
import { eq } from "drizzle-orm";
import db from "../../src/db";
import { bots } from "../../src/db/schema";
import { snapshotBot } from "../../src/lib/bot-versions";

const DRY = process.argv.includes("--dry-run") || process.argv.includes("--dry");
const MARK = "ЕЗИК И ТОЧНОСТ НА ТЕКСТА:";

/** Клиентът на всеки бот: име и пол (по картите на персонажите). */
const CLIENTS: Record<string, { name: string; female: boolean }> = {
  "call-scenario-loyal": { name: "Иван", female: false },
  "call-scenario-pensioner": { name: "Пламенка", female: true },
  "call-scenario-preapproved": { name: "Надежда", female: true },
  "call-scenario-promo": { name: "Стоян", female: false },
  "call-scenario-referral": { name: "Валя", female: true },
  "meeting-scenario-new": { name: "Ива", female: true },
  "meeting-scenario-existing-new": { name: "Стоян", female: false },
  "meeting-scenario-home-visit": { name: "София", female: true },
  "meeting-scenario-refinance": { name: "Блажка", female: true },
};

function languageBlock(key: string): string {
  const c = CLIENTS[key];
  const gender = c.female
    ? `Клиентът е жена (${c.name}): говори за нея в женски род — „клиентката“, „тя“, „ѝ“, „нея“, „нейният“; не използвай „клиентът“, „му“, „неговият“ за нея.`
    : `Клиентът е мъж (${c.name}): говори за него в мъжки род — „клиентът“, „той“, „му“, „него“, „неговият“.`;
  return (
    `${MARK}\n` +
    `- Пиши на правилен книжовен български: съгласувай по род и число, спазвай правилата за пълен и кратък член, не превеждай буквално от английски (например вместо „валидирам“, „адресирам“, „персонализирам“ използвай „показвам, че разбирам“, „отговарям на“, „съобразявам с“). ` +
    `За консултанта пиши неутрално („консултантът“), без да предполагаш пола му: когато му се обръщаш на „ти“, избягвай форми, които издават пола (например „сигурен“, „доволен“, „убеден“, „си бил“), и не смесвай „ти“ с „консултантът“ в един и същ анализ — следвай указанието за тона по-горе.\n` +
    `- ${gender}\n` +
    `- Описвай само реално случилото се в разговора. Не твърди, че са станали кандидатстване, одобрение, подписване на договор или отпускане на средства, освен ако това ясно личи от репликите; ако консултантът само го е казал, пиши, че го е казал, а не че е станало. Разговорът е симулация и в него няма реална система за одобрение.\n\n`
  );
}

function once(text: string, from: string, to: string, what: string): string {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${what}: очаквах 1 съвпадение на „${from.slice(0, 60)}…“, има ${n}`);
  return text.replace(from, to);
}

function all(text: string, from: string, to: string, expected: number, what: string): string {
  const n = text.split(from).length - 1;
  if (n !== expected) throw new Error(`${what}: очаквах ${expected} съвпадения на „${from}“, има ${n}`);
  return text.split(from).join(to);
}

function transformAnalysis(key: string, ap: string): string {
  let p = ap;
  if (p.includes(MARK)) throw new Error(`${key}: блокът за език вече е добавен`);
  if (key === "meeting-scenario-new") {
    p = once(p, "ФОКУС НА СЦЕНАРИЯ: Ива Иванова — 45 г.,", "ФОКУС НА СЦЕНАРИЯ: Ива Иванова — нов клиент, 45 г.,", `${key} AP нов клиент`);
    p = once(p, "Подала е онлайн заявка и след разговор на националния телефон посещава регионален офис, за да провери лично условията.", "Подала е онлайн заявка и след разговор на националния телефон посещава регионален офис, за да научи условията на място и да ги провери лично.", `${key} AP офис`);
    p = once(p, "600 евро за 11 двуседмични периода", "600 евро за 11 двуседмични вноски", `${key} AP вноски`);
  }
  const marker = "Върни САМО валиден JSON";
  const idx = p.indexOf(marker);
  if (idx < 0 || p.indexOf(marker, idx + 1) >= 0) throw new Error(`${key}: не намирам еднозначно „${marker}“`);
  return p.slice(0, idx) + languageBlock(key) + p.slice(idx);
}

function transformSystem(sp: string): string {
  let p = sp;
  // 3.1 — нов клиент
  p = once(
    p,
    "Това е първото ти кандидатстване в Изи Кредит и първата среща на живо по него. Вече е имало онлайн и телефонен контакт.",
    "Това е първото ти кандидатстване в Изи Кредит и първата среща на живо по него. Вече е имало онлайн и телефонен контакт.\n\nТи си НОВ клиент на Изи Кредит: кандидатствала си онлайн и идваш в офиса, за да научиш условията на място, преди да решиш дали да продължиш.",
    "SP нов клиент"
  );
  // 3.2 — „периоди" -> „вноски"
  p = all(p, "11 двуседмични периода като 11 седмици", "11 двуседмични вноски като 11 седмици", 1, "SP не-седмици");
  p = once(p, "сумата на броя периоди", "сумата на броя на вноските", "SP деление");
  p = all(p, "600 евро за 11 двуседмични периода", "600 евро за 11 двуседмични вноски", 3, "SP предложение");
  if (/период/i.test(p)) throw new Error("SP: остава „период“");
  return p;
}

async function main() {
  const keys = Object.keys(CLIENTS);
  for (const key of keys) {
    const bot = await db.select().from(bots).where(eq(bots.key, key)).then((r) => r[0]);
    if (!bot?.analysisPrompt) throw new Error(`${key}: няма analysisPrompt`);
    const nextAp = transformAnalysis(key, bot.analysisPrompt);
    const nextSp = key === "meeting-scenario-new" ? transformSystem(bot.systemPrompt) : bot.systemPrompt;
    console.log(`${key.padEnd(32)} AP ${bot.analysisPrompt.length} -> ${nextAp.length}` + (nextSp !== bot.systemPrompt ? `  SP ${bot.systemPrompt.length} -> ${nextSp.length}` : ""));
    if (DRY) {
      if (key === "meeting-scenario-new" || key === "call-scenario-loyal") {
        console.log("\n--- блок за " + key + " ---\n" + languageBlock(key));
      }
      if (nextSp !== bot.systemPrompt) {
        const a = bot.systemPrompt.split("\n");
        const b = nextSp.split("\n");
        console.log("--- diff systemPrompt (редове) ---");
        const setA = new Set(a);
        const setB = new Set(b);
        for (const l of a) if (!setB.has(l)) console.log("  - " + l);
        for (const l of b) if (!setA.has(l)) console.log("  + " + l);
      }
      continue;
    }
    await snapshotBot(bot, null, "script");
    await db.update(bots).set({ analysisPrompt: nextAp, systemPrompt: nextSp, updatedAt: new Date() }).where(eq(bots.key, key));
  }
  console.log(DRY ? "\nDRY RUN — нищо не е записано." : "\nЗаписано.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
