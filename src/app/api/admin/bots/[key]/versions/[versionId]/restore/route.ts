import { auth } from "@/auth";
import db from "@/db";
import { bots, botVersions, auditLog } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  getBotByKey,
  snapshotBot,
  snapshotToBotUpdate,
} from "@/lib/bot-versions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ key: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "it") {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  const { key, versionId } = await params;

  const version = await db
    .select()
    .from(botVersions)
    .where(and(eq(botVersions.id, versionId), eq(botVersions.botKey, key)))
    .then((r) => r[0]);
  if (!version) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  const current = await getBotByKey(key);
  if (!current) {
    return Response.json({ error: "Bot not found" }, { status: 404 });
  }

  // Текущото състояние също се пази, за да може да се върне и „назад от връщането“.
  await snapshotBot(current, session.user.id, "restore");

  await db
    .update(bots)
    .set(snapshotToBotUpdate(version))
    .where(eq(bots.key, key));

  await db.insert(auditLog).values({
    actorId: session.user.id,
    action: "bot.restore",
    target: key,
    meta: { versionId, versionChangedAt: version.changedAt },
  });

  return Response.json({ success: true });
}
