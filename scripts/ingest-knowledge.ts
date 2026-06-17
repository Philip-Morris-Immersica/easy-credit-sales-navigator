/**
 * Ingests the full content of tree.ts into knowledge_chunks with embeddings.
 * Run with: npx tsx scripts/ingest-knowledge.ts
 * Re-run after editing tree.ts to refresh the knowledge base.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

// Import the full content tree
import { salesNavigatorConfig } from "../src/content/index";
import type { NavNode, ContentBlock } from "../src/components/navigator/types";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

interface Chunk {
  slugPath: string;
  title: string;
  content: string;
}

function extractText(blocks: ContentBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        parts.push(`# ${block.text}`);
        break;
      case "paragraph":
        parts.push(block.text);
        break;
      case "bullets":
        parts.push(block.items.map((b: string) => `• ${b}`).join("\n"));
        break;
      case "goal":
        parts.push(`Цел: ${block.text}`);
        break;
      case "note":
        parts.push(`Важно: ${block.text}`);
        break;
      case "fields":
        parts.push(
          block.rows
            .map((f: { label: string; value: string }) => `${f.label}: ${f.value}`)
            .join("\n")
        );
        break;
      case "dialogue":
        if (block.label) parts.push(`[${block.label}]`);
        parts.push(block.lines.join("\n"));
        break;
      case "tabs":
        for (const tab of block.tabs) {
          parts.push(`[${tab.label}]`);
          parts.push(extractText(tab.blocks));
        }
        break;
      case "collapsible":
        parts.push(`[${block.label}]`);
        parts.push(extractText(block.blocks));
        break;
      case "actions":
        break;
      default:
        break;
    }
  }

  return parts.filter(Boolean).join("\n");
}

function collectChunks(
  node: NavNode,
  parentPath: string[] = []
): Chunk[] {
  const chunks: Chunk[] = [];
  const currentPath = [...parentPath, node.slug];
  const slugPath = currentPath.join("/");

  const textParts: string[] = [];
  if (node.title) textParts.push(`# ${node.title}`);
  const n = node as unknown as Record<string, unknown>;
  if (n.subtitle) textParts.push(String(n.subtitle));
  if (n.description) textParts.push(String(n.description));

  if (node.content && node.content.length > 0) {
    textParts.push(extractText(node.content));
  }

  const fullText = textParts.filter(Boolean).join("\n\n");

  if (fullText.trim().length > 30) {
    chunks.push({
      slugPath,
      title: node.title ?? slugPath,
      content: fullText.trim(),
    });
  }

  if (node.children) {
    for (const child of node.children) {
      chunks.push(...collectChunks(child, currentPath));
    }
  }

  return chunks;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set — storing text chunks without embeddings.");
    console.log("Run again after adding the key to enable vector search.");
  }

  // Collect all chunks from all directions
  const allChunks: Chunk[] = [];
  for (const direction of salesNavigatorConfig.directions) {
    allChunks.push(...collectChunks(direction));
  }

  console.log(`Collected ${allChunks.length} chunks from tree.ts`);

  // Clear existing tree chunks
  await db.delete(schema.knowledgeChunks).where(eq(schema.knowledgeChunks.source, "tree"));
  console.log("Cleared existing tree chunks");

  // Generate embeddings in batches of 20
  const BATCH = 20;
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH);
    let embeddings: number[][] | null = null;

    if (process.env.OPENAI_API_KEY) {
      try {
        const result = await embedMany({
          model: openai.embedding("text-embedding-3-small"),
          values: batch.map((c) => `${c.title}\n${c.content}`),
        });
        embeddings = result.embeddings;
      } catch (e) {
        console.warn("Embedding failed, storing without vector:", e);
      }
    }

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      await db.insert(schema.knowledgeChunks).values({
        source: "tree",
        slugPath: chunk.slugPath,
        title: chunk.title,
        content: chunk.content,
        embedding: embeddings?.[j] ?? null,
      });
    }

    process.stdout.write(`\r  ${Math.min(i + BATCH, allChunks.length)}/${allChunks.length} chunks stored`);
  }

  console.log("\nKnowledge base ingestion complete!");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
