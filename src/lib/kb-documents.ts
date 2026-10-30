import db from "@/db";
import {
  kbDocuments,
  kbDocumentVersions,
  knowledgeChunks,
  auditLog,
  type KbDocument,
} from "@/db/schema";
import { KB_CATEGORIES, type KbCategory } from "@/lib/kb-categories";
import { KB_FORBIDDEN_CONFIRM_LABEL } from "@/lib/kb-rules";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { cosineDistance, gt, sql } from "drizzle-orm";
import { extractExactTokens, mergeHits, rankExactHits } from "@/lib/kb-exact";

// ─── Константи ────────────────────────────────────────────────────────────────

export const MAX_DOC_VERSIONS = 10;
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel ограничава тялото на заявката до ~4.5 MB
export const MAX_TEXT_CHARS = 250_000;
export const MAX_CHUNKS_PER_DOC = 250;
const MAX_CHUNK_CHARS = 1400;
const MIN_CHUNK_CHARS = 20;
const EMBED_BATCH = 50;
const EMBEDDING_MODEL = "text-embedding-3-small"; // същият като при tree.ts — иначе векторите не са сравними

export const ACCEPTED_EXTENSIONS = [".md", ".txt", ".docx"] as const;

export class KbError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ─── Парсване на файл ─────────────────────────────────────────────────────────

export interface ParsedDocument {
  text: string;
  meta: Record<string, string>;
}

function normalizeNewlines(s: string): string {
  return s.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

const META_KEYS: Record<string, string> = {
  "заглавие": "title",
  "категория": "category",
  "валидно_от": "validFrom",
  "валидно от": "validFrom",
  "версия": "version",
};

/**
 * Отделя метаданните (front-matter) от тялото.
 * Поддържа `--- ... ---` (Markdown) и няколко реда „Ключ: стойност“ най-отгоре (Word).
 */
export function parseFrontMatter(input: string): { meta: Record<string, string>; body: string } {
  const text = normalizeNewlines(input);
  const meta: Record<string, string> = {};

  const fm = text.match(/^\s*---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const m = line.match(/^\s*([^:#]+?)\s*:\s*(.*?)\s*$/);
      if (!m) continue;
      const key = META_KEYS[m[1].trim().toLowerCase()];
      const value = m[2].replace(/\s+#.*$/, "").trim();
      if (key && value) meta[key] = value;
    }
    return { meta, body: text.slice(fm[0].length) };
  }

  // Word: „Заглавие: …“ / „Категория: …“ най-отгоре, преди първия абзац/заглавие
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  let consumed = 0;
  let end = i;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") {
      if (consumed > 0) { end = i + 1; continue; }
      continue;
    }
    const m = line.replace(/^[*_\s]+|[*_\s]+$/g, "").match(/^([^:]{3,20}):\s*(.+)$/);
    const key = m ? META_KEYS[m[1].trim().toLowerCase().replace(/[*_]/g, "")] : undefined;
    if (!m || !key) break;
    meta[key] = m[2].replace(/[*_]/g, "").trim();
    consumed++;
    end = i + 1;
  }
  if (consumed === 0) return { meta: {}, body: text };
  return { meta, body: lines.slice(end).join("\n") };
}

export function normalizeCategory(value: string | undefined | null): KbCategory | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return (KB_CATEGORIES as readonly string[]).includes(v) ? (v as KbCategory) : null;
}

/**
 * Таблица от mammoth → Markdown таблица: ЕДИН ред от таблицата = ЕДИН текстов ред
 * (`| ГПР | Годишен процент … |`), със заглавен ред и разделител. Клетките са плоски:
 * абзаците, <br> и списъците вътре в клетка се слепват с интервал — иначе празният ред
 * от `</p>` разцепва реда на части и чънкването го реже на произволно място.
 * Знаците `&…;` се оставят кодирани — декодират се накрая, заедно с останалия текст.
 */
function tableHtmlToMarkdown(tableHtml: string): string {
  const rows: string[][] = [];
  for (const tr of tableHtml.match(/<tr[\s>][\s\S]*?<\/tr>/gi) ?? []) {
    const cells = (tr.match(/<t[dh][\s>][\s\S]*?<\/t[dh]>/gi) ?? []).map((cell) =>
      cell
        .replace(/<\/(p|li)>|<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .replace(/\|/g, "\\|")
        .trim()
    );
    if (cells.some((c) => c !== "")) rows.push(cells);
  }
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? "").join(" | ")} |`;
  const [head, ...body] = rows;
  return `\n\n${[line(head), `|${" --- |".repeat(width)}`, ...body.map(line)].join("\n")}\n\n`;
}

/** Опростява HTML от mammoth до Markdown-подобен текст: заглавия (#/##), списъци, абзаци, таблици. */
export function htmlToMarkdownText(html: string): string {
  return html
    .replace(/<table[\s>][\s\S]*?<\/table>/gi, (t) => tableHtmlToMarkdown(t))
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, inner: string) => {
      const marks = Number(lvl) === 1 ? "#" : Number(lvl) === 2 ? "##" : "###";
      return `\n\n${marks} ${inner.replace(/<[^>]+>/g, "").trim()}\n\n`;
    })
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(ul|ol)>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseUploadedFile(
  fileName: string,
  buffer: Buffer
): Promise<ParsedDocument> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    throw new KbError(
      "PDF файлове не се приемат: таблиците и колоните в PDF се извличат разбъркано, а разбъркан текст е по-лош за бота от липсващ документ. Запишете документа като Word (.docx) или Markdown (.md) и го качете отново."
    );
  }
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new KbError("Позволени формати: .docx, .md, .txt.");
  }
  if (buffer.length === 0) throw new KbError("Файлът е празен.");
  if (buffer.length > MAX_FILE_BYTES) {
    throw new KbError("Файлът е твърде голям (максимум 4 MB).");
  }

  let raw: string;
  if (lower.endsWith(".docx")) {
    assertZipNotBomb(buffer);
    const mammoth = await import("mammoth");
    let converted: { value: string };
    try {
      converted = await mammoth.convertToHtml({ buffer });
    } catch {
      throw new KbError("Файлът не може да бъде прочетен. Уверете се, че е валиден .docx (не .doc).");
    }
    raw = htmlToMarkdownText(converted.value);
  } else {
    raw = buffer.toString("utf8");
  }

  const { meta, body } = parseFrontMatter(raw);
  const text = body.trim();
  if (text.length < MIN_CHUNK_CHARS) throw new KbError("Документът не съдържа достатъчно текст.");
  if (text.length > MAX_TEXT_CHARS) {
    throw new KbError("Документът е твърде дълъг. Разделете го на няколко по-малки.");
  }
  return { text, meta };
}

const CONFLICT_MESSAGE = "Документът е променен междувременно от друг потребител. Презаредете страницата и опитайте отново.";
const MAX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;

/**
 * .docx е zip архив. Размерът на качения файл (4 MB) не казва колко ще се разгърне —
 * четем размерите от централната директория на архива, без да разархивираме нищо.
 */
function assertZipNotBomb(buffer: Buffer) {
  const bad = () => new KbError("Файлът не изглежда като валиден .docx или е прекалено голям след разархивиране.");
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw bad();
  const entries = buffer.readUInt16LE(eocd + 10);
  let pos = buffer.readUInt32LE(eocd + 16);
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) throw bad();
    const size = buffer.readUInt32LE(pos + 24);
    if (size === 0xffffffff) throw bad(); // ZIP64 — не се очаква в документ от Word
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) throw bad();
    pos += 46 + buffer.readUInt16LE(pos + 28) + buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32);
  }
}

// ─── Чънкване ─────────────────────────────────────────────────────────────────

export interface DocChunk {
  title: string;
  content: string;
}

interface Section {
  heading: string | null;
  body: string;
}

function splitSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: null, body: "" };
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const h = !inFence ? line.match(/^(#{1,2})\s+(.+?)\s*#*\s*$/) : null;
    if (h) {
      sections.push(current);
      current = { heading: h[2].trim(), body: "" };
    } else {
      current.body += line + "\n";
    }
  }
  sections.push(current);
  return sections.map((s) => ({ ...s, body: s.body.trim() }));
}

const isTableLine = (line: string) => /^\s*\|/.test(line);
const isTableSeparator = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes("-");
/** Блок от редове, които всички са редове на Markdown таблица. */
const isTableBlock = (block: string) => block.split("\n").every(isTableLine);

/** Максимален размер на група редове от дълга таблица — по-малка група = по-точен embedding. */
const MAX_TABLE_CHUNK_CHARS = 1000;

/**
 * Реже дълга таблица на групи от цели редове; заглавният ред (и разделителят) се повтарят
 * във всяка група. Ред НИКОГА не се разцепва — дори да е по-дълъг от `max`, остава сам в група.
 */
export function splitTable(block: string, max: number): string[] {
  const lines = block.split("\n").filter((l) => l.trim() !== "");
  let header: string[] = [];
  let rows = lines;
  if (lines.length >= 2 && isTableSeparator(lines[1])) {
    header = lines.slice(0, 2);
    rows = lines.slice(2);
  }
  const head = header.join("\n");
  const groups: string[] = [];
  let cur: string[] = [];
  let curLen = head.length;
  for (const row of rows) {
    if (cur.length > 0 && curLen + 1 + row.length > max) {
      groups.push([...header, ...cur].join("\n"));
      cur = [];
      curLen = head.length;
    }
    cur.push(row);
    curLen += 1 + row.length;
  }
  if (cur.length > 0) groups.push([...header, ...cur].join("\n"));
  return groups;
}

/** Абзаци + таблици като отделни единици (таблица, залепена за текст без празен ред, се отделя). */
function splitUnits(body: string): string[] {
  const units: string[] = [];
  for (const p of body.split(/\n{2,}/)) {
    const lines = p.split("\n");
    if (!lines.some(isTableLine) || lines.every(isTableLine)) { units.push(p); continue; }
    let run: string[] = [];
    let runIsTable = isTableLine(lines[0]);
    for (const l of lines) {
      if (isTableLine(l) !== runIsTable) { units.push(run.join("\n")); run = []; runIsTable = !runIsTable; }
      run.push(l);
    }
    if (run.length) units.push(run.join("\n"));
  }
  return units;
}

/** Реже дълъг текст по абзаци; „Въпрос“ и „Отговор“ остават заедно; редовете на таблица никога не се разцепват. */
function splitLong(body: string, max: number): string[] {
  if (body.length <= max) return [body];
  const units: string[] = [];
  for (const p of splitUnits(body)) {
    const isAnswer = /^\s*(\*\*|_)?\s*(отговор|отг)\b/i.test(p);
    if (isAnswer && units.length > 0) units[units.length - 1] += "\n\n" + p;
    else units.push(p);
  }
  const out: string[] = [];
  let buf = "";
  const flush = () => { if (buf.trim()) out.push(buf.trim()); buf = ""; };
  for (const unit of units) {
    if (unit.length > MAX_TABLE_CHUNK_CHARS && isTableBlock(unit)) {
      flush();
      out.push(...splitTable(unit, MAX_TABLE_CHUNK_CHARS));
      continue;
    }
    if (unit.length > max) {
      flush();
      // Много дълъг абзац: режем по изречения, накрая твърдо.
      const sentences = unit.split(/(?<=[.!?…])\s+/);
      let piece = "";
      for (const s of sentences) {
        if ((piece + " " + s).length > max && piece) { out.push(piece.trim()); piece = s; }
        else piece = piece ? piece + " " + s : s;
        while (piece.length > max * 1.5) { out.push(piece.slice(0, max)); piece = piece.slice(max); }
      }
      if (piece.trim()) out.push(piece.trim());
      continue;
    }
    if ((buf + "\n\n" + unit).length > max && buf) flush();
    buf = buf ? buf + "\n\n" + unit : unit;
  }
  flush();
  return out;
}

/**
 * Един „##“ = един чънк. Всеки чънк носи в началото името на документа,
 * категорията и валидността, за да има контекст и извън документа.
 */
export function chunkDocument(
  title: string,
  category: string,
  meta: Record<string, string> | null,
  text: string
): DocChunk[] {
  const header =
    `Документ: ${title} (${category}` +
    (meta?.validFrom ? `, валидно от ${meta.validFrom}` : "") +
    ")";
  const chunks: DocChunk[] = [];

  for (const section of splitSections(normalizeNewlines(text))) {
    if (section.body.length < MIN_CHUNK_CHARS) continue;
    const pieces = splitLong(section.body, MAX_CHUNK_CHARS);
    pieces.forEach((piece, idx) => {
      const part = pieces.length > 1 ? ` (част ${idx + 1}/${pieces.length})` : "";
      const chunkTitle = section.heading ? `${title} — ${section.heading}${part}` : `${title}${part}`;
      const headingLine = section.heading ? `## ${section.heading}${part}\n` : "";
      chunks.push({ title: chunkTitle, content: `${header}\n${headingLine}${piece}` });
    });
  }

  if (chunks.length === 0 && text.trim().length >= MIN_CHUNK_CHARS) {
    for (const piece of splitLong(text.trim(), MAX_CHUNK_CHARS)) {
      chunks.push({ title, content: `${header}\n${piece}` });
    }
  }
  if (chunks.length > MAX_CHUNKS_PER_DOC) {
    throw new KbError("Документът е твърде дълъг. Разделете го на няколко по-малки.");
  }
  return chunks;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedValues(values: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new KbError("Липсва OPENAI_API_KEY — документът не може да бъде индексиран.", 500);
  }
  const all: number[][] = [];
  try {
    for (let i = 0; i < values.length; i += EMBED_BATCH) {
      const { embeddings } = await embedMany({
        model: openai.embedding(EMBEDDING_MODEL),
        values: values.slice(i, i + EMBED_BATCH),
      });
      all.push(...embeddings);
    }
  } catch (e) {
    throw new KbError(`Индексирането не успя (OpenAI): ${e instanceof Error ? e.message : String(e)}`, 502);
  }
  return all;
}

/**
 * Чънква и индексира документ. Embedding-ите се смятат ПРЕДИ да се пипа старото
 * (neon-http няма транзакции) — ако OpenAI откаже, старият индекс остава непокътнат.
 */
export async function indexDocument(doc: Pick<KbDocument, "id" | "title" | "category" | "rawText" | "meta">) {
  const meta = (doc.meta ?? null) as Record<string, string> | null;
  const chunks = chunkDocument(doc.title, doc.category, meta, doc.rawText);
  const embeddings = await embedValues(chunks.map((c) => `${c.title}\n${c.content}`));

  await writeChunks(doc.id, chunks, embeddings);
  return chunks.length;
}

/** Заменя чънковете на документа. Чънковете на дървото (source='tree') никога не се докосват. */
async function writeChunks(documentId: string, chunks: DocChunk[], embeddings: number[][]) {
  // Един групов INSERT (една SQL заявка е атомарна): прекъсване не оставя половин индекс.
  const rows = chunks.map((c, i) => ({
    source: "document" as const,
    documentId,
    slugPath: `doc/${documentId}`,
    title: c.title,
    content: c.content,
    embedding: embeddings[i],
  }));
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
  if (rows.length) await db.insert(knowledgeChunks).values(rows);
}

export async function removeDocumentChunks(documentId: string) {
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
}

// ─── Операции върху документи ─────────────────────────────────────────────────

async function audit(actorId: string, action: string, target: string, meta?: Record<string, unknown>) {
  await db.insert(auditLog).values({ actorId, action, target, meta: meta ?? null });
}

async function snapshotVersion(doc: KbDocument, actorId: string, reason: "replace" | "restore" | "archive") {
  await db.insert(kbDocumentVersions).values({
    documentId: doc.id,
    version: doc.version,
    title: doc.title,
    category: doc.category,
    fileName: doc.fileName,
    rawText: doc.rawText,
    meta: doc.meta,
    reason,
    changedBy: actorId,
  });
  const keep = await db
    .select({ id: kbDocumentVersions.id })
    .from(kbDocumentVersions)
    .where(eq(kbDocumentVersions.documentId, doc.id))
    .orderBy(desc(kbDocumentVersions.changedAt))
    .limit(MAX_DOC_VERSIONS);
  await db.delete(kbDocumentVersions).where(
    and(
      eq(kbDocumentVersions.documentId, doc.id),
      notInArray(kbDocumentVersions.id, keep.map((k) => k.id))
    )
  );
}

export async function getDocument(id: string): Promise<KbDocument | undefined> {
  return db.select().from(kbDocuments).where(eq(kbDocuments.id, id)).then((r) => r[0]);
}

interface UploadInput {
  title: string;
  category: KbCategory;
  fileName: string;
  mimeType: string;
  parsed: ParsedDocument;
  actorId: string;
  /** Администраторът е потвърдил, че файлът не съдържа забранени материали (записва се в журнала). */
  forbiddenConfirmed: true;
}

export async function createDocument(input: UploadInput): Promise<{ doc: KbDocument; chunks: number }> {
  const [doc] = await db
    .insert(kbDocuments)
    .values({
      title: input.title,
      category: input.category,
      fileName: input.fileName,
      mimeType: input.mimeType,
      rawText: input.parsed.text,
      meta: input.parsed.meta,
      uploadedBy: input.actorId,
    })
    .returning();
  try {
    const chunks = await indexDocument(doc);
    await audit(input.actorId, "kb.document.create", doc.id, {
      title: doc.title,
      category: doc.category,
      chunks,
      forbiddenMaterialsConfirmed: input.forbiddenConfirmed,
      confirmation: KB_FORBIDDEN_CONFIRM_LABEL,
    });
    return { doc, chunks };
  } catch (e) {
    // Не оставяме документ, който Роби не може да намери.
    await db.delete(kbDocuments).where(eq(kbDocuments.id, doc.id));
    throw e;
  }
}

/** Качване на нова версия на съществуващ документ. */
export async function replaceDocument(
  id: string,
  input: Omit<UploadInput, "category"> & { category?: KbCategory }
): Promise<{ doc: KbDocument; chunks: number }> {
  const current = await getDocument(id);
  if (!current) throw new KbError("Документът не е намерен.", 404);

  const next = {
    title: input.title || current.title,
    category: input.category ?? (current.category as KbCategory),
    rawText: input.parsed.text,
    meta: input.parsed.meta,
  };
  // Проверяваме, че индексирането ще мине, преди да пипаме каквото и да е.
  const chunks = chunkDocument(next.title, next.category, next.meta, next.rawText);
  const embeddings = await embedValues(chunks.map((c) => `${c.title}\n${c.content}`));

  // Оптимистично заключване: обновяваме само ако версията още е прочетената.
  const [doc] = await db
    .update(kbDocuments)
    .set({
      ...next,
      fileName: input.fileName,
      mimeType: input.mimeType,
      version: current.version + 1,
      status: "active",
      updatedAt: new Date(),
    })
    .where(and(eq(kbDocuments.id, id), eq(kbDocuments.version, current.version)))
    .returning();
  if (!doc) throw new KbError(CONFLICT_MESSAGE, 409);
  await snapshotVersion(current, input.actorId, "replace");

  await writeChunks(id, chunks, embeddings);
  await audit(input.actorId, "kb.document.replace", id, {
    title: doc.title,
    version: doc.version,
    chunks: chunks.length,
    forbiddenMaterialsConfirmed: input.forbiddenConfirmed,
    confirmation: KB_FORBIDDEN_CONFIRM_LABEL,
  });
  return { doc, chunks: chunks.length };
}

/** „Изтриване“ — меко. Чънковете се махат от индекса, текстът остава. */
export async function archiveDocument(id: string, actorId: string) {
  const doc = await getDocument(id);
  if (!doc) throw new KbError("Документът не е намерен.", 404);
  await removeDocumentChunks(id); // първо махаме от индекса — при срив архивираният не остава търсим
  await db
    .update(kbDocuments)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(kbDocuments.id, id));
  await audit(actorId, "kb.document.archive", id, { title: doc.title });
}

export async function unarchiveDocument(id: string, actorId: string) {
  const doc = await getDocument(id);
  if (!doc) throw new KbError("Документът не е намерен.", 404);
  const chunks = await indexDocument(doc); // първо индексираме — ако откаже, остава архивиран
  await db
    .update(kbDocuments)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(kbDocuments.id, id));
  await audit(actorId, "kb.document.unarchive", id, { title: doc.title, chunks });
}

/** Връща документа към по-ранна версия; текущата се запазва в историята. */
export async function restoreDocumentVersion(id: string, versionId: string, actorId: string) {
  const current = await getDocument(id);
  if (!current) throw new KbError("Документът не е намерен.", 404);
  const old = await db
    .select()
    .from(kbDocumentVersions)
    .where(and(eq(kbDocumentVersions.id, versionId), eq(kbDocumentVersions.documentId, id)))
    .then((r) => r[0]);
  if (!old) throw new KbError("Версията не е намерена.", 404);

  const target = {
    id,
    title: old.title,
    category: old.category,
    rawText: old.rawText,
    meta: old.meta,
  };
  // индексираме предварително в паметта (проверка), после сменяме
  const chunks = chunkDocument(target.title, target.category, (target.meta ?? null) as Record<string, string> | null, target.rawText);
  const embeddings = await embedValues(chunks.map((c) => `${c.title}\n${c.content}`));

  const updated = await db
    .update(kbDocuments)
    .set({
      title: old.title,
      category: old.category,
      fileName: old.fileName,
      rawText: old.rawText,
      meta: old.meta,
      version: current.version + 1,
      status: "active",
      updatedAt: new Date(),
    })
    .where(and(eq(kbDocuments.id, id), eq(kbDocuments.version, current.version)))
    .returning({ id: kbDocuments.id });
  if (updated.length === 0) throw new KbError(CONFLICT_MESSAGE, 409);
  await snapshotVersion(current, actorId, "restore");
  await writeChunks(id, chunks, embeddings);
  await audit(actorId, "kb.document.restore", id, { fromVersion: old.version, newVersion: current.version + 1 });
}

/** Окончателно изтриване — само на вече изтрит (архивиран) документ, за да няма случайна загуба. */
export async function deleteDocumentPermanently(id: string, actorId: string) {
  const doc = await getDocument(id);
  if (!doc) throw new KbError("Документът не е намерен.", 404);
  if (doc.status !== "archived") {
    throw new KbError("Окончателно може да се изтрие само документ от „Изтрити“.", 409);
  }
  // Версиите и откъсите се трият каскадно.
  await db.delete(kbDocuments).where(eq(kbDocuments.id, id));
  await audit(actorId, "kb.document.delete", id, { title: doc.title, version: doc.version });
}

/** Изтрива една стара версия от историята. Текущата версия не се засяга. */
export async function deleteDocumentVersion(id: string, versionId: string, actorId: string) {
  const deleted = await db
    .delete(kbDocumentVersions)
    .where(and(eq(kbDocumentVersions.id, versionId), eq(kbDocumentVersions.documentId, id)))
    .returning({ version: kbDocumentVersions.version });
  if (deleted.length === 0) throw new KbError("Версията не е намерена.", 404);
  await audit(actorId, "kb.document.version.delete", id, { version: deleted[0].version });
}

/** Изтрива всички стари версии на документа. Текущата версия не се засяга. */
export async function deleteAllDocumentVersions(id: string, actorId: string) {
  const deleted = await db
    .delete(kbDocumentVersions)
    .where(eq(kbDocumentVersions.documentId, id))
    .returning({ id: kbDocumentVersions.id });
  await audit(actorId, "kb.document.versions.delete", id, { count: deleted.length });
}

// ─── Търсене ──────────────────────────────────────────────────────────────────

export type KnowledgeSource = "document" | "tree";

export interface SearchHit {
  title: string | null;
  content: string;
  similarity: number;
  /** true — откъсът съдържа съкращението от заявката като цяла дума (точно съвпадение). */
  exact?: boolean;
}

/** Колко откъса с точно съвпадение се добавят най-много към семантичните. */
const EXACT_LIMIT = 4;
/** Грубият SQL предфилтър връща най-много толкова кандидати; точната проверка е в JS. */
const EXACT_PREFILTER_LIMIT = 200;

const SEARCH_DEFAULTS: Record<KnowledgeSource, { threshold: number; limit: number }> = {
  // Праговете са мерени върху реални заявки на български (text-embedding-3-small дава
  // по-ниски стойности от очакваното): верните резултати са 0.44–0.76, несвързаните < 0.36.
  document: { threshold: 0.45, limit: 5 },
  tree: { threshold: 0.4, limit: 5 },
};

/**
 * Хибридно търсене: точно съвпадение на цяла дума за съкращения (ГПР, ППЗ, Bh-score)
 * + семантично. Точните са първи; дубликатите се махат. Ако заявката няма съкращения,
 * резултатът е същият като при чисто семантично търсене.
 */
export async function searchKnowledge(query: string, source: KnowledgeSource): Promise<SearchHit[]> {
  const { limit } = SEARCH_DEFAULTS[source];
  const [semantic, exact] = await Promise.allSettled([
    searchSemantic(query, source),
    searchExact(query, source),
  ]);
  const exactHits = exact.status === "fulfilled" ? exact.value : [];
  if (semantic.status === "rejected") {
    if (exactHits.length > 0) return exactHits; // OpenAI не отговаря, но точното съвпадение е налице
    throw semantic.reason;
  }
  return mergeHits(exactHits, semantic.value, limit);
}

/** Точно съвпадение: груб предфилтър в SQL (strpos — не зависи от локала), цяла дума в JS. */
async function searchExact(query: string, source: KnowledgeSource): Promise<SearchHit[]> {
  const tokens = extractExactTokens(query);
  if (tokens.length === 0) return [];
  const anyToken = sql.join(
    tokens.map((t) =>
      t.caseInsensitive
        ? sql`strpos(lower(${knowledgeChunks.content}), ${t.text.toLowerCase()}) > 0`
        : sql`strpos(${knowledgeChunks.content}, ${t.text}) > 0`
    ),
    sql` or `
  );
  const rows = await db
    .select({ title: knowledgeChunks.title, content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .leftJoin(kbDocuments, eq(knowledgeChunks.documentId, kbDocuments.id))
    .where(
      and(
        eq(knowledgeChunks.source, source),
        source === "document" ? eq(kbDocuments.status, "active") : undefined,
        sql`(${anyToken})`
      )
    )
    .limit(EXACT_PREFILTER_LIMIT);
  return rankExactHits(rows, tokens, EXACT_LIMIT).map((h) => ({
    title: h.title,
    content: h.content,
    similarity: 1,
    exact: true,
  }));
}

export async function searchSemantic(query: string, source: KnowledgeSource): Promise<SearchHit[]> {
  const { threshold, limit } = SEARCH_DEFAULTS[source];
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: query,
  });
  const similarity = sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, embedding)})`;
  return db
    .select({ title: knowledgeChunks.title, content: knowledgeChunks.content, similarity })
    .from(knowledgeChunks)
    .leftJoin(kbDocuments, eq(knowledgeChunks.documentId, kbDocuments.id))
    .where(
      and(
        eq(knowledgeChunks.source, source),
        gt(similarity, threshold),
        source === "document" ? eq(kbDocuments.status, "active") : undefined
      )
    )
    .orderBy(sql`${similarity} DESC`)
    .limit(limit);
}
