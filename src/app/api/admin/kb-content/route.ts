import { auth } from "@/auth";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import db from "@/db";
import { auditLog, kbFileVersions } from "@/db/schema";
import { and, desc, eq, notInArray } from "drizzle-orm";

export const runtime = "nodejs";

const TREE_PATH = path.join(process.cwd(), "src", "content", "sales-navigator", "tree.ts");
const TREE_KEY = "src/content/sales-navigator/tree.ts";
const MAX_FILE_VERSIONS = 10;

/** Пази текущото съдържание на файла ПРЕДИ презапис; подрязва до последните 10. */
async function snapshotTree(current: string, actorId: string) {
  const latest = await db
    .select({ content: kbFileVersions.content })
    .from(kbFileVersions)
    .where(eq(kbFileVersions.filePath, TREE_KEY))
    .orderBy(desc(kbFileVersions.changedAt))
    .limit(1)
    .then((r) => r[0]);
  if (latest?.content === current) return;

  await db.insert(kbFileVersions).values({ filePath: TREE_KEY, content: current, changedBy: actorId });
  const keep = await db
    .select({ id: kbFileVersions.id })
    .from(kbFileVersions)
    .where(eq(kbFileVersions.filePath, TREE_KEY))
    .orderBy(desc(kbFileVersions.changedAt))
    .limit(MAX_FILE_VERSIONS);
  await db.delete(kbFileVersions).where(
    and(eq(kbFileVersions.filePath, TREE_KEY), notInArray(kbFileVersions.id, keep.map((k) => k.id)))
  );
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "it") {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  try {
    if (new URL(req.url).searchParams.get("versions")) {
      const rows = await db
        .select({ id: kbFileVersions.id, changedAt: kbFileVersions.changedAt, content: kbFileVersions.content })
        .from(kbFileVersions)
        .where(eq(kbFileVersions.filePath, TREE_KEY))
        .orderBy(desc(kbFileVersions.changedAt));
      return Response.json({
        versions: rows.map((r) => ({ id: r.id, changedAt: r.changedAt.toISOString(), size: r.content.length })),
      });
    }
    const content = await readFile(TREE_PATH, "utf-8");
    return Response.json({ content });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "it") {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    let content: unknown = body.content;
    let action = "kb.tree.update";

    if (typeof body.restoreVersionId === "string") {
      const v = await db
        .select({ content: kbFileVersions.content })
        .from(kbFileVersions)
        .where(and(eq(kbFileVersions.id, body.restoreVersionId), eq(kbFileVersions.filePath, TREE_KEY)))
        .then((r) => r[0]);
      if (!v) return Response.json({ error: "Версията не е намерена." }, { status: 404 });
      content = v.content;
      action = "kb.tree.restore";
    }

    if (typeof content !== "string") {
      return Response.json({ error: "Invalid content" }, { status: 400 });
    }

    const current = await readFile(TREE_PATH, "utf-8");
    await snapshotTree(current, session.user.id);
    await writeFile(TREE_PATH, content, "utf-8");
    await db.insert(auditLog).values({
      actorId: session.user.id,
      action,
      target: TREE_KEY,
      meta: { size: content.length },
    });
    return Response.json({ success: true, content });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
