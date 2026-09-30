import { auth } from "@/auth";
import { isUserActive } from "@/lib/auth-helpers";
import { reindexTree } from "@/lib/kb-tree-index";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Реиндексира дървото (tree.ts). Качените документи не се пипат. */
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "it" || !(await isUserActive(session.user.id))) {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  try {
    const chunksStored = await reindexTree();
    return Response.json({ success: true, chunksStored });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
