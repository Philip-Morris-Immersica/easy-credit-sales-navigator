/**
 * Изчистване на нашите тестове (решение на Филип, 31.10.2026):
 *  - основните акаунти на Immersica остават, но БЕЗ разговори;
 *  - вторите ни акаунти, „Тест“ (123456@abv.bg) и 5-те демо акаунта (@demo.invalid) се трият изцяло.
 * Разходите минават в cost_rollups преди триенето (purgeUserQuery). Журнал: user.delete / conversation.purge.
 * Акаунтите на Easy Credit НЕ се пипат.
 *
 * Пускане:  npx tsx scripts/one-off/2026-10-31-iztrivane-nashi-testove.ts --dry-run
 *           npx tsx scripts/one-off/2026-10-31-iztrivane-nashi-testove.ts
 */
import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";
import db from "../../src/db";
import { users, auditLog } from "../../src/db/schema";
import { costRollupsTableExists, purgeUserQuery } from "../../src/lib/retention";

const DRY = process.argv.includes("--dry-run");

const KEEP_EMPTY = ["philip_morris3316@hotmail.com", "ninachupetlovska@gmail.com", "ig@businesseffect.bg"];
const DELETE = [
  "philip.ivanov@immersica.io", "nina.chupetlovska@immersica.io", "stephanie.gergova@immersica.io",
  "ea@businesseffect.bg", "123456@abv.bg",
  "test.sluzhitel@demo.invalid", "test.admin@demo.invalid", "test.it@demo.invalid",
  "test.iztrivane@demo.invalid", "test.deaktiviran@demo.invalid",
];

async function counts(userId: string) {
  const r = await db.execute(sql`
    SELECT (SELECT count(*) FROM conversations WHERE user_id = ${userId})::int AS convs,
           (SELECT count(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = ${userId})::int AS msgs,
           (SELECT count(*) FROM analyses a JOIN conversations c ON c.id = a.conversation_id WHERE c.user_id = ${userId})::int AS ans`);
  return r.rows[0] as { convs: number; msgs: number; ans: number };
}

async function main() {
  if (!(await costRollupsTableExists())) throw new Error("Липсва cost_rollups");
  const all = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users).where(inArray(users.email, [...KEEP_EMPTY, ...DELETE]));
  const actor = all.find((u) => u.email === "philip_morris3316@hotmail.com")!;
  const missing = [...KEEP_EMPTY, ...DELETE].filter((e) => !all.some((u) => u.email === e));
  if (missing.length) console.log("Няма ги (пропускам):", missing.join(", "));

  for (const u of all) {
    const c = await counts(u.id);
    const del = DELETE.includes(u.email);
    console.log(`${del ? "ИЗТРИВАНЕ НА АКАУНТ " : "само разговорите   "} ${u.role.padEnd(5)} ${u.email.padEnd(32)} разговори ${c.convs}, съобщения ${c.msgs}, анализи ${c.ans}`);
    if (DRY) continue;
    if (c.convs) await db.execute(purgeUserQuery(u.id));
    if (del) {
      await db.delete(users).where(eq(users.id, u.id));
      await db.insert(auditLog).values({ actorId: actor.id, action: "user.delete", target: u.id,
        meta: { conversations: c.convs, messages: c.msgs, analyses: c.ans, reason: "cleanup-immersica-tests" } });
    } else if (c.convs) {
      await db.insert(auditLog).values({ actorId: actor.id, action: "conversation.purge", target: u.id,
        meta: { conversations: c.convs, messages: c.msgs, analyses: c.ans, reason: "cleanup-immersica-tests" } });
    }
  }
  console.log(DRY ? "--dry-run: нищо не е изтрито." : "Готово.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
