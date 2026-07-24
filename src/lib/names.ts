/**
 * Normalises a display name (#A2.2): trims and collapses internal whitespace.
 * Deliberately does NOT re-capitalize — heuristic casing risks mangling
 * legitimate names (e.g. "де Йонг", "МВ"). Returns null for empty input.
 */
export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 ? cleaned : null;
}
