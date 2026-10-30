import { runRetention } from "@/lib/retention";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Автоматично изтриване на разговори, по-стари от срока на съхранение (Т6,
 * Р-03; срокът е в `RETENTION_MONTHS`, src/lib/retention.ts). Пуска се всеки
 * ден в 03:00 (vercel.json). Защитата е същата като при /api/cron/sweep-stale:
 * CRON_SECRET, който Vercel праща като `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRetention();
  return Response.json({ ok: !result.skipped, ...result });
}
