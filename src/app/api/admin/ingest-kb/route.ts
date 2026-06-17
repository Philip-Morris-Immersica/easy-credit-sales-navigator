import { auth } from "@/auth";
import db from "@/db";
import { knowledgeChunks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { salesNavigatorConfig } from "@/content/index";
import type { NavNode, ContentBlock } from "@/components/navigator/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "it") {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  try {
    const chunks = collectAllChunks();
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.source, "tree"));

    const BATCH = 20;
    let stored = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      let embeddings: number[][] | null = null;

      if (process.env.OPENAI_API_KEY) {
        try {
          const result = await embedMany({
            model: openai.embedding("text-embedding-3-small"),
            values: batch.map((c) => `${c.title}\n${c.content}`),
          });
          embeddings = result.embeddings;
        } catch { /* store without embeddings */ }
      }

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        await db.insert(knowledgeChunks).values({
          source: "tree",
          slugPath: chunk.slugPath,
          title: chunk.title,
          content: chunk.content,
          embedding: embeddings?.[j] ?? null,
        });
        stored++;
      }
    }

    return Response.json({ success: true, chunksStored: stored });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
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

function collectAllChunks(): ChunkData[] {
  const all: ChunkData[] = [];
  for (const direction of salesNavigatorConfig.directions) all.push(...collectChunks(direction));
  return all;
}
