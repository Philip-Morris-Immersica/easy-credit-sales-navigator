/**
 * Date helpers for the admin filters (#A2.1).
 *
 * Two problems this fixes:
 *  1. Presets/defaults computed with `new Date().toISOString().slice(0,10)` use
 *     UTC, so in the early hours of a Sofia day the admin saw the *previous* day.
 *  2. The server parsed date-only strings (`new Date("2026-07-24")`) as UTC
 *     midnight, shifting the day boundaries 2–3h vs. the Bulgarian calendar day.
 *
 * The client helpers below produce *local* ISO dates; the server helpers turn a
 * picked calendar day into the correct UTC instant for Europe/Sofia (DST-safe).
 */

export const APP_TIMEZONE = "Europe/Sofia";

/** Platform launch — used as the start of the "Всичко" (all-time) period. */
export const LAUNCH_ISO = "2026-01-01";

/** Formats a Date into `yyyy-MM-dd` using its **local** calendar components. */
export function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date as a local `yyyy-MM-dd` string. */
export function todayIso(): string {
  return toLocalIso(new Date());
}

/** The date `n` days before today, as a local `yyyy-MM-dd` string. */
export function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalIso(d);
}

/**
 * Offset (ms) to add to a UTC instant to get wall-clock time in `timeZone`.
 * Computed for the specific instant, so DST transitions are handled correctly.
 */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // `Intl` can emit hour "24" at midnight — normalise to 0.
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - instant.getTime();
}

/** UTC `Date` for 00:00:00.000 of the given calendar day in `timeZone`. */
export function zonedDayStart(iso: string, timeZone: string = APP_TIMEZONE): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const offset = tzOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

/** UTC `Date` for 23:59:59.999 of the given calendar day in `timeZone`. */
export function zonedDayEnd(iso: string, timeZone: string = APP_TIMEZONE): Date {
  const start = zonedDayStart(iso, timeZone);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}
