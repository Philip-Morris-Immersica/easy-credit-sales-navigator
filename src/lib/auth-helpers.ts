import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type AppRole = "user" | "admin" | "it";

/** Returns current session user, or redirects to /login */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
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

export function isAdmin(role: string) {
  return role === "admin" || role === "it";
}

export function isIT(role: string) {
  return role === "it";
}
