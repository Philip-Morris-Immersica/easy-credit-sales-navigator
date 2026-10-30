/**
 * Т10: демо акаунти за снимките на инструкцията (без реални хора и данни).
 * Изтриват се при изчистването на тестовите данни (Т11) — всички са с домейн @demo.invalid.
 * Паролата се взима от DEMO_PASSWORD (не се пази в репото).
 *
 * Пускане:  DEMO_PASSWORD=... npx tsx scripts/one-off/2026-10-31-t10-demo-akaunti.ts --dry-run
 *           DEMO_PASSWORD=... npx tsx scripts/one-off/2026-10-31-t10-demo-akaunti.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";
import db from "../../src/db";
import { users } from "../../src/db/schema";

const DRY = process.argv.includes("--dry-run");
const PASSWORD = process.env.DEMO_PASSWORD;

const DEMO: { name: string; email: string; role: "user" | "admin" | "it"; active: boolean }[] = [
  { name: "Тест Служител", email: "test.sluzhitel@demo.invalid", role: "user", active: true },
  { name: "Тест Администратор", email: "test.admin@demo.invalid", role: "admin", active: true },
  { name: "Тест ИТ", email: "test.it@demo.invalid", role: "it", active: true },
  { name: "Тест Изтриване", email: "test.iztrivane@demo.invalid", role: "user", active: true },
  { name: "Тест Деактивиран", email: "test.deaktiviran@demo.invalid", role: "user", active: false },
];

async function main() {
  if (!PASSWORD || PASSWORD.length < 12) throw new Error("DEMO_PASSWORD (≥12 знака) липсва");
  const existing = await db.select({ email: users.email }).from(users)
    .where(inArray(users.email, DEMO.map((d) => d.email)));
  const have = new Set(existing.map((e) => e.email));
  const todo = DEMO.filter((d) => !have.has(d.email));
  for (const d of DEMO) console.log(`${have.has(d.email) ? "има  " : "нов  "} ${d.role.padEnd(5)} ${d.name} <${d.email}>${d.active ? "" : " (деактивиран)"}`);
  if (DRY || todo.length === 0) return console.log(DRY ? "--dry-run: нищо не е записано." : "Нищо за добавяне.");
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await db.insert(users).values(todo.map((d) => ({ ...d, passwordHash })));
  console.log(`Добавени: ${todo.length}.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
