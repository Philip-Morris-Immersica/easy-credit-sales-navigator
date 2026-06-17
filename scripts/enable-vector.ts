import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log("pgvector extension enabled");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("pgvector note:", msg);
  }
  process.exit(0);
}

main();
