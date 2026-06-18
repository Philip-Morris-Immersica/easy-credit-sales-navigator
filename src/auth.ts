import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, (credentials.email as string).toLowerCase()))
          .then((rows) => rows[0]);

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        })]
      : []),
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
      ? [MicrosoftEntraId({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
        })]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // credentials: authorize() puts role on user; OAuth: role is absent → fetch from DB
        const credentialsRole = (user as { role?: string }).role;
        let role: string;
        if (credentialsRole) {
          role = credentialsRole;
        } else {
          const dbUser = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, user.id!))
            .then((r) => r[0]);
          role = dbUser?.role ?? "user";
        }

        // Auto-upgrade INITIAL_IT_EMAIL to "it" regardless of login method
        const itEmail = process.env.INITIAL_IT_EMAIL?.toLowerCase();
        if (itEmail && user.email?.toLowerCase() === itEmail && role !== "it") {
          role = "it";
          await db
            .update(users)
            .set({ role: "it" })
            .where(eq(users.id, user.id!));
        }

        token.role = role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider !== "credentials" && user.email) {
        const existing = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.email, user.email))
          .then((r) => r[0]);
        const itEmail = process.env.INITIAL_IT_EMAIL?.toLowerCase();
        const isIT = itEmail && user.email.toLowerCase() === itEmail;
        if (!existing) {
          await db.insert(users).values({
            id: user.id ?? crypto.randomUUID(),
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            role: isIT ? "it" : "user",
          });
        } else if (isIT && existing.role !== "it") {
          await db.update(users).set({ role: "it" }).where(eq(users.id, existing.id));
        }
      }
      return true;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
    };
  }
}
