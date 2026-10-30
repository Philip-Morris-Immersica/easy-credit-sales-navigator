/**
 * Прилага drizzle/0001_cost_rollups.sql (Т6) — нова таблица, адитивно.
 * Пуска се САМО след преглед от Филип:  npx tsx scripts/apply-cost-rollups.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const file = readFileSync(join(process.cwd(), "drizzle", "0001_cost_rollups.sql"), "utf8");
  const statements = file
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await sql.query(stmt);
      process.stdout.write(".");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) process.stdout.write("s");
      else throw e;
    }
  }
  console.log("\nГотово: cost_rollups е създадена.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
