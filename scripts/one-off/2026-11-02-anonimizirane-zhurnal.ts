/**
 * Еднократно: в журнала (audit_log) махаме имейла/името на вече изтрити потребители —
 * същото, което DELETE /api/admin/users/[id] прави вече при всяко изтриване.
 * Пускане:  npx tsx scripts/one-off/2026-11-02-anonimizirane-zhurnal.ts --dry-run
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const DRY = process.argv.includes("--dry-run");
(async () => {
  const roles = await sql`SELECT count(*)::int n FROM audit_log a WHERE action='user.role.set' AND target <> 'изтрит потребител' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = a.target)`;
  const renames = await sql`SELECT count(*)::int n FROM audit_log a WHERE action='user.rename' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.target)`;
  console.log(`user.role.set с имейл на изтрит: ${roles[0].n}; user.rename на изтрит: ${renames[0].n}`);
  if (DRY) return console.log("--dry-run");
  await sql`UPDATE audit_log a SET target='изтрит потребител' WHERE action='user.role.set' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = a.target)`;
  await sql`UPDATE audit_log a SET meta='{"name":"изтрит потребител"}'::jsonb WHERE action='user.rename' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.target)`;
  console.log("Готово.");
})();
