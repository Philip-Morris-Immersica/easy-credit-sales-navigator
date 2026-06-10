import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const u = new URL(url);
console.log("Connecting to host:", u.hostname);
console.log("Database:", u.pathname.replace("/", ""));
console.log("User:", u.username);

const sql = neon(url);

const dbInfo = await sql`
  SELECT current_database() AS db,
         current_user        AS usr,
         inet_server_addr()::text AS server_ip,
         version()           AS version
`;
console.log("\n=== Server info ===");
console.log(dbInfo[0]);

const tables = await sql`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  ORDER BY table_schema, table_name
`;

console.log("\n=== Existing tables (user schemas) ===");
if (tables.length === 0) {
  console.log("(none — database is EMPTY, safe to push schema)");
} else {
  console.table(tables);
}
