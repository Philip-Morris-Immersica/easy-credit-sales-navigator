import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";

export type AppRole = "user" | "admin" | "it";

/**
 * Returns current session user, or redirects to /login.
 *
 * Also re-checks the `active` flag against the DB on every call. The JWT
 * session strategy means a deactivated user's session cookie stays valid
 * until it expires, so without this check they could keep using the app
 * after being deactivated.
 *
 * Note: this calls `redirect()`, not Auth.js `signOut()` — Server Components
 * cannot write cookies (only Server Actions / Route Handlers / Middleware
 * can), so the session cookie itself isn't cleared here. That's an
 * acceptable tradeoff: every protected page re-checks the DB and bounces
 * the deactivated user back to /login regardless, so they can never reach
 * app content. Cost: one extra DB read per protected page load — fine for
 * an internal tool at this scale.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const dbUser = await db
    .select({ active: users.active })
    .from(users)
    .where(eq(users.id, session.user.id))
    .then((r) => r[0]);

  if (!dbUser || !dbUser.active) redirect("/login");

  return session.user;
}

/** Requires admin or IT role, redirects otherwise */
export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "it") redirect("/");
  return user;
}

/** Requires IT role only */
export async function requireIT() {
  const user = await requireAuth();
  if (user.role !== "it") redirect("/admin");
  return user;
}

/**
 * DB-level active check for API route handlers. Route handlers return JSON (not
 * redirects), so they can't use `requireAuth()`. Since the session is a 30-day
 * JWT, a user deactivated mid-session keeps a valid token — every sensitive API
 * route must re-check `active` against the DB before acting.
 */
export async function isUserActive(userId: string): Promise<boolean> {
  const row = await db
    .select({ active: users.active })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0]);
  return !!row?.active;
}

export function isAdmin(role: string) {
  return role === "admin" || role === "it";
}

export function isIT(role: string) {
  return role === "it";
}
