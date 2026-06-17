import { auth } from "@/auth";
import db from "@/db";
import { bots, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  const { systemPrompt, analysisPrompt, welcomeMessage, model, temperature, maxTokens, enabled } = body;

  await db
    .update(bots)
    .set({
      systemPrompt,
      analysisPrompt: analysisPrompt || null,
      welcomeMessage,
      model,
      temperature,
      maxTokens,
      enabled,
      updatedAt: new Date(),
    })
    .where(eq(bots.key, key));

  await db.insert(auditLog).values({
    actorId: session.user.id,
    action: "bot.update",
    target: key,
    meta: { model, temperature, maxTokens, enabled },
  });

  return Response.json({ success: true });
}
