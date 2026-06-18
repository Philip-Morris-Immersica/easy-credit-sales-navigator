import { auth } from "@/auth";
import db from "@/db";
import { analyses, conversations, users, bots } from "@/db/schema";
import { eq, gte, lte, and, inArray } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "it")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { from, to, userIds } = await req.json() as {
      from: string;
      to: string;
      userIds?: string[];
    };

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const rows = await db
      .select({
        analysisId: analyses.id,
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
          userIds && userIds.length > 0
            ? inArray(conversations.userId, userIds)
            : undefined
        )
      );

    if (rows.length === 0) {
      return Response.json({ summary: "Няма анализи за избрания период и потребители." });
    }

    const avg = rows.reduce((s, r) => s + (r.overallScore ?? 0), 0) / rows.length;
    const allStrengths = rows.flatMap((r) => r.strengths ?? []);
    const allImprovements = rows.flatMap((r) => r.improvements ?? []);
    const summaries = rows.map((r) => r.summary).filter(Boolean);

    const prompt = `Ти си мениджър по продажбите. Имаш ${rows.length} AI-анализа на разговори за периода ${from} – ${to}.

Средна оценка: ${avg.toFixed(1)}/10

Силни страни (${allStrengths.length} бр):
${allStrengths.slice(0, 20).map((s) => `- ${s}`).join("\n")}

Области за подобрение (${allImprovements.length} бр):
${allImprovements.slice(0, 20).map((s) => `- ${s}`).join("\n")}

Обобщения на анализите:
${summaries.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join("\n")}

Направи кратко обобщение (максимум 300 думи) на представянето на екипа, подчертай основните тенденции и дай 3 конкретни препоръки за подобрение. Отговори на български.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxOutputTokens: 600,
    });

    return Response.json({
      summary: text,
      stats: {
        total: rows.length,
        avgScore: parseFloat(avg.toFixed(2)),
        topStrengths: [...new Set(allStrengths)].slice(0, 5),
        topImprovements: [...new Set(allImprovements)].slice(0, 5),
      },
    });
  } catch (err) {
    console.error("[analytics-summary] POST error:", err);
    return Response.json({ error: "Грешка при обобщение: " + String(err) }, { status: 500 });
  }
}
