import { auth } from "@/auth";
import db from "@/db";
import { bots, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getBotByKey, snapshotBot } from "@/lib/bot-versions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "it") {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  const { key } = await params;
  const body = await req.json();

  const {
    systemPrompt, welcomeMessage, model, temperature, maxTokens, enabled,
    analysisPrompt, analysisModel, analysisTemperature, analysisMaxTokens,
  } = body;

  // Пазим текущото състояние ПРЕДИ презаписа (история на версиите).
  const current = await getBotByKey(key);
  if (!current) {
    return Response.json({ error: "Bot not found" }, { status: 404 });
  }
  await snapshotBot(current, session.user.id, "edit");

  await db
    .update(bots)
    .set({
      systemPrompt,
      welcomeMessage,
      model,
      temperature,
      maxTokens,
      enabled,
      analysisPrompt: analysisPrompt || null,
      analysisModel: analysisModel || null,
      analysisTemperature: analysisTemperature ?? 0.3,
      analysisMaxTokens: analysisMaxTokens ?? 1500,
      updatedAt: new Date(),
    })
    .where(eq(bots.key, key));

  await db.insert(auditLog).values({
    actorId: session.user.id,
    action: "bot.update",
    target: key,
    meta: { model, temperature, maxTokens, analysisModel, analysisTemperature, analysisMaxTokens, enabled },
  });

  return Response.json({ success: true });
}
