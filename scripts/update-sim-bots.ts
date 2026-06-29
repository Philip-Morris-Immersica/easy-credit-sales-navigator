import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { bots } from "../src/db/schema";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql });

  const rows = await db
    .select({ key: bots.key, title: bots.title, model: bots.model, temperature: bots.temperature })
    .from(bots)
    .where(eq(bots.kind, "simulation"));

  console.log("Simulation bots before update:");
  console.table(rows);

  await db
    .update(bots)
    .set({ model: "gpt-4.1", temperature: 0.2, updatedAt: new Date() })
    .where(eq(bots.kind, "simulation"));

  console.log(`\nUpdated ${rows.length} simulation bot(s) → model: gpt-4.1, temperature: 0.2`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
