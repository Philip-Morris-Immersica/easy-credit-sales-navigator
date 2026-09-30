import db from "@/db";
import { knowledgeChunks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { salesNavigatorConfig } from "@/content/index";
import type { NavNode, ContentBlock, PersonaData } from "@/components/navigator/types";

/** Текстът на картата на персонажа, за да влезе в знанието на Роби (5.13). */
function personaText(p: PersonaData): string {
  return [
    `Персонаж: ${p.name}`,
    `Тип контакт: ${p.contactType}`,
    `Отношение: ${p.relationship}`,
    `Очаквано обръщение: ${p.addressForm}`,
    `Цел: ${p.goal}`,
    `Очаквана следваща стъпка: ${p.nextStep}`,
    `Какво консултантът НЕ бива да прави: ${p.doNotDo}`,
  ].join("\n");
}

function extractText(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading": parts.push(`# ${block.text}`); break;
      case "paragraph": parts.push(block.text); break;
      case "bullets": parts.push(block.items.map((b: string) => `• ${b}`).join("\n")); break;
      case "goal": parts.push(`Цел: ${block.text}`); break;
      case "note": parts.push(`Важно: ${block.text}`); break;
      case "fields": parts.push(block.rows.map((f: { label: string; value: string }) => `${f.label}: ${f.value}`).join("\n")); break;
      case "dialogue": if (block.label) parts.push(`[${block.label}]`); parts.push(block.lines.join("\n")); break;
      case "tabs": for (const tab of block.tabs) { parts.push(`[${tab.label}]`); parts.push(extractText(tab.blocks)); } break;
      case "collapsible": parts.push(`[${block.label}]`); parts.push(extractText(block.blocks)); break;
      case "actions": if (block.persona) parts.push(personaText(block.persona)); break;
    }
  }
  return parts.filter(Boolean).join("\n");
}

interface ChunkData { slugPath: string; title: string; content: string; }

function collectChunks(node: NavNode, parentPath: string[] = []): ChunkData[] {
  const chunks: ChunkData[] = [];
  const currentPath = [...parentPath, node.slug];
  const slugPath = currentPath.join("/");
  const textParts: string[] = [];
  if (node.title) textParts.push(`# ${node.title}`);
  const n = node as unknown as Record<string, unknown>;
  if (n.subtitle) textParts.push(String(n.subtitle));
  if (n.description) textParts.push(String(n.description));
  if (node.content?.length) textParts.push(extractText(node.content));
  const fullText = textParts.filter(Boolean).join("\n\n");
  if (fullText.trim().length > 30) chunks.push({ slugPath, title: node.title ?? slugPath, content: fullText.trim() });
  if (node.children) for (const child of node.children) chunks.push(...collectChunks(child, currentPath));
  return chunks;
}

export function collectAllChunks(): ChunkData[] {
  const all: ChunkData[] = [];
  for (const direction of salesNavigatorConfig.directions) all.push(...collectChunks(direction));
  return all;
}

/**
 * Реиндексира САМО дървото (source='tree'). Качените документи (source='document')
 * никога не се докосват. Embedding-ите се смятат преди изтриването — при грешка
 * от OpenAI старият индекс остава.
 */
export async function reindexTree(): Promise<number> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Липсва OPENAI_API_KEY.");
  const chunks = collectAllChunks();

  const BATCH = 50;
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const { embeddings: e } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: chunks.slice(i, i + BATCH).map((c) => `${c.title}\n${c.content}`),
    });
    embeddings.push(...e);
  }

  // Един групов INSERT (една SQL заявка е атомарна) — прекъсване не оставя частично дърво.
  const rows = chunks.map((c, i) => ({
    source: "tree" as const,
    slugPath: c.slugPath,
    title: c.title,
    content: c.content,
    embedding: embeddings[i],
  }));
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.source, "tree"));
  if (rows.length) await db.insert(knowledgeChunks).values(rows);
  return chunks.length;
}
