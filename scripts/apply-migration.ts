import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const migrationPath = join(process.cwd(), "drizzle", "0000_tan_red_hulk.sql");
  const migrationSQL = readFileSync(migrationPath, "utf8");

  const statements = migrationSQL
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Applying ${statements.length} statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await sql.query(stmt);
      process.stdout.write(".");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists") || msg.includes("duplicate")) {
        process.stdout.write("s");
      } else {
        console.error(`\nFailed stmt ${i + 1}:`, msg.split("\n")[0]);
      }
    }
  }

  console.log("\nDone!");
  process.exit(0);
}

main();
