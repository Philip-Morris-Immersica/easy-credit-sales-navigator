import { auth } from "@/auth";
import { isUserActive } from "@/lib/auth-helpers";
import db from "@/db";
import { conversations, bots, analyses } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserActive(session.user.id))) {
    return Response.json({ error: "Акаунтът е деактивиран." }, { status: 403 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const role = session.user.role;
  const isAdminOrIT = role === "admin" || role === "it";

  // Admins can query any userId, regular users only their own
  const targetUserId = isAdminOrIT && userId ? userId : session.user.id;

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      kind: conversations.kind,
      status: conversations.status,
      startedAt: conversations.startedAt,
      lastActivityAt: conversations.lastActivityAt,
      botTitle: bots.title,
      botKey: bots.key,
      overallScore: analyses.overallScore,
    })
    .from(conversations)
    .leftJoin(bots, eq(conversations.botId, bots.id))
    .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
    .where(eq(conversations.userId, targetUserId))
    .orderBy(desc(conversations.lastActivityAt))
    .limit(50);

  return Response.json(rows);
}
