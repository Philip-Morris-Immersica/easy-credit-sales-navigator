import { auth } from "@/auth";
import db from "@/db";
import { analyses, conversations, users, bots } from "@/db/schema";
import { eq, gte, lte, and, inArray, desc } from "drizzle-orm";
import { zonedDayStart, zonedDayEnd, LAUNCH_ISO, todayIso } from "@/lib/date-range";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "it")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const userIds = searchParams.getAll("userId");

    // Interpret the picked days as Europe/Sofia calendar days (#A2.1).
    const fromDate = zonedDayStart(fromStr ?? LAUNCH_ISO);
    const toDate = zonedDayEnd(toStr ?? todayIso());

    const rows = await db
      .select({
        id: analyses.id,
        conversationId: analyses.conversationId,
        overallScore: analyses.overallScore,
        summary: analyses.summary,
        strengths: analyses.strengths,
        improvements: analyses.improvements,
        createdAt: analyses.createdAt,
        userName: users.name,
        userEmail: users.email,
        botTitle: bots.title,
        userId: conversations.userId,
      })
      .from(analyses)
      .leftJoin(conversations, eq(analyses.conversationId, conversations.id))
      .leftJoin(users, eq(conversations.userId, users.id))
      .leftJoin(bots, eq(analyses.botId, bots.id))
      .where(
        and(
          gte(analyses.createdAt, fromDate),
          lte(analyses.createdAt, toDate),
          userIds.length > 0 ? inArray(conversations.userId, userIds) : undefined
        )
      )
      .orderBy(desc(analyses.createdAt))
      .limit(500);

    return Response.json({ analyses: rows });
  } catch (err) {
    console.error("[analytics] GET error:", err);
    return Response.json({ error: "Вътрешна грешка" }, { status: 500 });
  }
}
