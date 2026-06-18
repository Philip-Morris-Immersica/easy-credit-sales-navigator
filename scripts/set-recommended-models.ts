/**
 * Updates bot models to recommended settings:
 *   - Simulation bots: chat=gpt-4.1-mini, analysis=gpt-4.1
 *   - Consultant bot:  chat=gpt-4.1,      analysis=null (no analysis)
 *
 * Run: npx tsx scripts/set-recommended-models.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

async function main() {
  const allBots = await db.select({ key: schema.bots.key, kind: schema.bots.kind }).from(schema.bots);

  for (const bot of allBots) {
    if (bot.kind === "simulation") {
      await db
        .update(schema.bots)
        .set({
          model: "gpt-4.1-mini",
          temperature: 0.7,
          maxTokens: 2000,
          analysisModel: "gpt-4.1",
          analysisTemperature: 0.3,
          analysisMaxTokens: 1500,
          updatedAt: new Date(),
        })
        .where(eq(schema.bots.key, bot.key));
      console.log(`✓ ${bot.key}: sim(gpt-4.1-mini, t=0.7) | analysis(gpt-4.1, t=0.3)`);
    } else {
      await db
        .update(schema.bots)
        .set({
          model: "gpt-4.1",
          temperature: 0.7,
          maxTokens: 2000,
          analysisModel: null,
          analysisTemperature: 0.3,
          analysisMaxTokens: 1500,
          updatedAt: new Date(),
        })
        .where(eq(schema.bots.key, bot.key));
      console.log(`✓ ${bot.key}: chat(gpt-4.1, t=0.7)`);
    }
  }

  console.log("\nDone!");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
