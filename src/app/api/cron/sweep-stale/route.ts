import { sweepStaleSimulations } from "@/lib/conversations";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled cleanup of stale "active" simulations (#2.7). Wired to a daily
 * Vercel Cron (see vercel.json). Protected by CRON_SECRET: Vercel sends it as
 * `Authorization: Bearer <CRON_SECRET>` when the env var is configured.
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

  const result = await sweepStaleSimulations(true);
  return Response.json({ ok: true, ...result });
}
