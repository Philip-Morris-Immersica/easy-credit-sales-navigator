import db from "@/db";
import { bots } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  const bot = await db
    .select({
      key: bots.key,
      title: bots.title,
      welcomeMessage: bots.welcomeMessage,
      kind: bots.kind,
      enabled: bots.enabled,
    })
    .from(bots)
    .where(eq(bots.key, key))
    .then((r) => r[0]);

  if (!bot || !bot.enabled) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(bot);
}
