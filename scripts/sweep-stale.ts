import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, lt } from "drizzle-orm";
import * as schema from "../src/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

const STALE_DAYS = 7;

/**
 * One-off maintenance: clear the backlog of stale "active" simulations by
 * marking them "abandoned". Intentionally does NOT run the LLM analysis (to
 * avoid surprise cost on old data); the scheduled cron handles fresh sessions
 * going forward and analyses the longer ones.
 */
async function main() {
  const staleBefore = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const updated = await db
    .update(schema.conversations)
    .set({ status: "abandoned" })
    .where(
      and(
        eq(schema.conversations.kind, "simulation"),
        eq(schema.conversations.status, "active"),
        lt(schema.conversations.lastActivityAt, staleBefore)
      )
    )
    .returning({ id: schema.conversations.id });

  console.log(
    `Marked ${updated.length} stale "active" simulation(s) as "abandoned" (idle > ${STALE_DAYS} days).`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
