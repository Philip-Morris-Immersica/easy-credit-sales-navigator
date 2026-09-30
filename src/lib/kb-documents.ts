import db from "@/db";
import {
  kbDocuments,
  kbDocumentVersions,
  knowledgeChunks,
  auditLog,
  type KbDocument,
} from "@/db/schema";
import { KB_CATEGORIES, type KbCategory } from "@/lib/kb-categories";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { cosineDistance, gt, sql } from "drizzle-orm";

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

/** Опростява HTML от mammoth до Markdown-подобен текст: заглавия (#/##), списъци, абзаци, редове от таблица. */
export function htmlToMarkdownText(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, inner: string) => {
      const marks = Number(lvl) === 1 ? "#" : Number(lvl) === 2 ? "##" : "###";
      return `\n\n${marks} ${inner.replace(/<[^>]+>/g, "").trim()}\n\n`;
    })
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(ul|ol)>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]*\|[ \t]*\n/g, "\n")
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

/** Реже дълъг текст по абзаци; „Въпрос“ и „Отговор“ остават заедно. */
function splitLong(body: string, max: number): string[] {
  if (body.length <= max) return [body];
  const paragraphs = body.split(/\n{2,}/);
  const units: string[] = [];
  for (const p of paragraphs) {
    const isAnswer = /^\s*(\*\*|_)?\s*(отговор|отг)\b/i.test(p);
    if (isAnswer && units.length > 0) units[units.length - 1] += "\n\n" + p;
    else units.push(p);
  }
  const out: string[] = [];
  let buf = "";
  const flush = () => { if (buf.trim()) out.push(buf.trim()); buf = ""; };
  for (const unit of units) {
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
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
  for (let i = 0; i < chunks.length; i++) {
    await db.insert(knowledgeChunks).values({
      source: "document",
      documentId,
      slugPath: `doc/${documentId}`,
      title: chunks[i].title,
      content: chunks[i].content,
      embedding: embeddings[i],
    });
  }
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
    await audit(input.actorId, "kb.document.create", doc.id, { title: doc.title, category: doc.category, chunks });
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

  await snapshotVersion(current, input.actorId, "replace");
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
    .where(eq(kbDocuments.id, id))
    .returning();

  await writeChunks(id, chunks, embeddings);
  await audit(input.actorId, "kb.document.replace", id, { title: doc.title, version: doc.version, chunks: chunks.length });
  return { doc, chunks: chunks.length };
}

/** „Изтриване“ — меко. Чънковете се махат от индекса, текстът остава. */
export async function archiveDocument(id: string, actorId: string) {
  const doc = await getDocument(id);
  if (!doc) throw new KbError("Документът не е намерен.", 404);
  await db
    .update(kbDocuments)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(kbDocuments.id, id));
  await removeDocumentChunks(id);
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

  await snapshotVersion(current, actorId, "restore");
  await db
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
    .where(eq(kbDocuments.id, id));
  await writeChunks(id, chunks, embeddings);
  await audit(actorId, "kb.document.restore", id, { fromVersion: old.version, newVersion: current.version + 1 });
}

// ─── Търсене ──────────────────────────────────────────────────────────────────

export type KnowledgeSource = "document" | "tree";

export interface SearchHit {
  title: string | null;
  content: string;
  similarity: number;
}

const SEARCH_DEFAULTS: Record<KnowledgeSource, { threshold: number; limit: number }> = {
  // Праговете са мерени върху реални заявки на български (text-embedding-3-small дава
  // по-ниски стойности от очакваното): верните резултати са 0.44–0.76, несвързаните < 0.36.
  document: { threshold: 0.45, limit: 5 },
  tree: { threshold: 0.4, limit: 5 },
};

export async function searchKnowledge(query: string, source: KnowledgeSource): Promise<SearchHit[]> {
  const { threshold, limit } = SEARCH_DEFAULTS[source];
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: query,
  });
  const similarity = sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, embedding)})`;
  return db
    .select({ title: knowledgeChunks.title, content: knowledgeChunks.content, similarity })
    .from(knowledgeChunks)
    .where(and(eq(knowledgeChunks.source, source), gt(similarity, threshold)))
    .orderBy(sql`${similarity} DESC`)
    .limit(limit);
}
