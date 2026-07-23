"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { signIn, signOut } from "@/auth";
import db from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { Resend } from "resend";

export async function registerUser(email: string, password: string, name: string) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .then((r) => r[0]);

  if (existing) {
    return { error: "Потребител с този имейл вече съществува." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const itEmail = process.env.INITIAL_IT_EMAIL?.toLowerCase();
  const role = itEmail && email.toLowerCase() === itEmail ? "it" : "user";

  // Normalize whitespace only — no heuristic re-capitalization, since that
  // risks mangling legitimate names.
  const cleanName = name?.trim().replace(/\s+/g, " ") || null;

  await db.insert(users).values({
    email: email.toLowerCase(),
    name: cleanName,
    passwordHash,
    role,
  });

  return { success: true };
}

export async function loginWithCredentials(email: string, password: string, callbackUrl?: string) {
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl ?? "/",
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("CredentialsSignin") || msg.includes("credentials")) {
      return { error: "Невалиден имейл или парола." };
    }
    // signIn throws NEXT_REDIRECT on success — rethrow it
    throw e;
  }
}

export async function logoutUser() {
  await signOut({ redirectTo: "/login" });
}

export type LoginFailureReason =
  | "no-user"
  | "bad-password"
  | "oauth-only"
  | "unknown";

/**
 * Verifies credentials server-side and returns a specific reason on failure, so
 * the UI can tell the user exactly what went wrong instead of relying on the
 * (opaque) Auth.js error result. Note: distinguishing "no user" from "wrong
 * password" allows email enumeration — acceptable here for an internal tool.
 */
export async function diagnoseLoginFailure(
  email: string,
  password: string
): Promise<{ reason: LoginFailureReason }> {
  const user = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .then((r) => r[0]);

  if (!user) return { reason: "no-user" };
  if (!user.passwordHash) return { reason: "oauth-only" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { reason: "bad-password" };

  return { reason: "unknown" };
}

/**
 * Reports which OAuth providers are actually configured (env vars present), so
 * the login UI only renders buttons that can succeed.
 */
export async function getEnabledOAuthProviders(): Promise<{
  google: boolean;
  microsoft: boolean;
}> {
  return {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    microsoft: Boolean(
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
        process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
    ),
  };
}

export async function sendPasswordReset(email: string) {
  const user = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .then((r) => r[0]);

  // Always return success to prevent email enumeration
  if (!user) return { success: true };

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expires,
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "noreply@yourdomain.com",
      to: email,
      subject: "Нулиране на парола — Навигатор за продажбени умения",
      html: `<p>Здравейте${user.name ? ` ${user.name}` : ""},</p>
<p>Кликнете <a href="${resetUrl}">тук</a>, за да нулирате паролата си. Линкът е валиден 1 час.</p>
<p>Ако не сте правили тази заявка, игнорирайте имейла.</p>`,
    });
  }

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .then((r) => r[0]);

  if (!record) return { error: "Невалиден токен." };
  if (record.usedAt) return { error: "Токенът вече е използван." };
  if (record.expires < new Date()) return { error: "Токенът е изтекъл." };

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.update(users).set({ passwordHash }).where(eq(users.id, record.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));

  return { success: true };
}
