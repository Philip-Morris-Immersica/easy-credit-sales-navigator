/**
 * Т4.5: подмяна на „Речник“ (v1, нарязан по стария начин) с нова версия от оригиналния файл —
 * същото като „Нова версия“ в админ панела, но от скрипт. Старата версия остава в историята.
 *
 * Пускане:  npx tsx scripts/one-off/2026-10-30-t4-5-rechnik-nova-versiya.ts --dry-run
 *           npx tsx scripts/one-off/2026-10-30-t4-5-rechnik-nova-versiya.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import db from "../../src/db";
import { users } from "../../src/db/schema";
import { chunkDocument, getDocument, parseUploadedFile, replaceDocument } from "../../src/lib/kb-documents";
import type { KbCategory } from "../../src/lib/kb-categories";

const DOC_ID = "4ceaaa53-af39-4317-90e3-efbf10cb3199";
const FILE = "C:/Users/Work Account/Downloads/Речник - съкращения и термини.docx";
const DRY = process.argv.includes("--dry-run");

async function main() {
  const doc = await getDocument(DOC_ID);
  if (!doc) throw new Error("Документът не е намерен");
  const fileName = path.basename(FILE);
  const parsed = await parseUploadedFile(fileName, fs.readFileSync(FILE));
  const chunks = chunkDocument(doc.title, doc.category as KbCategory, parsed.meta, parsed.text);
  console.log(`„${doc.title}“ v${doc.version} (${doc.status}) → нова версия: ${chunks.length} откъса`);
  for (const c of chunks.slice(0, 3)) console.log(`  · ${c.title}: ${c.content.slice(0, 120).replace(/\n/g, " ⏎ ")}`);
  if (DRY) return console.log("--dry-run: нищо не е записано.");

  const actor = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, process.env.INITIAL_IT_EMAIL!.toLowerCase())).then((r) => r[0]);
  if (!actor) throw new Error("Няма IT потребител");
  const res = await replaceDocument(DOC_ID, {
    title: doc.title,
    fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parsed,
    actorId: actor.id,
    forbiddenConfirmed: true,
  });
  console.log(`Готово: v${res.doc.version}, ${res.chunks} откъса.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
