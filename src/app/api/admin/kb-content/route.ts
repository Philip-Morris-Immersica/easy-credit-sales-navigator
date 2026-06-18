import { auth } from "@/auth";
import { readFile, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const TREE_PATH = path.join(process.cwd(), "src", "content", "sales-navigator", "tree.ts");

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "it") {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  try {
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
    const { content } = await req.json();
    if (typeof content !== "string") {
      return Response.json({ error: "Invalid content" }, { status: 400 });
    }
    await writeFile(TREE_PATH, content, "utf-8");
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
