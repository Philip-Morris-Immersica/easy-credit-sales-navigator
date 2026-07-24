import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { isUserActive } from "@/lib/auth-helpers";
import db from "@/db";
import { conversations } from "@/db/schema";
import { generateAnalysisForConversation } from "@/lib/analysis";
import { MIN_USER_TURNS_FOR_ANALYSIS } from "@/lib/analysis-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserActive(session.user.id))) {
    return Response.json({ error: "Акаунтът е деактивиран." }, { status: 403 });
  }

  const { conversationId } = await req.json();

  // Ownership check — a user may only analyse their own conversations.
  const conv = await db
    .select({ userId: conversations.userId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .then((r) => r[0]);

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });
  if (conv.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Server-side gate (#2.6): don't let the min-turns requirement be bypassed by
  // calling the API directly. The threshold is enforced inside the helper.
  const result = await generateAnalysisForConversation(conversationId, {
    minUserTurns: MIN_USER_TURNS_FOR_ANALYSIS,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ analysis: result.analysis, cost: result.cost });
}
