import "server-only";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { redirect } from "next/navigation";
import { newId, now, one, run } from "../db";
import type { Register } from "../types";
import { sqliteAdapter } from "./adapter";

export const devLoginEnabled = process.env.DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const providers: Provider[] = [
  Nodemailer({
    server: process.env.EMAIL_SERVER || "smtp://localhost:25",
    from: process.env.EMAIL_FROM || "Idea2Proto <no-reply@localhost>",
    ...(process.env.EMAIL_SERVER
      ? {}
      : {
          // No SMTP configured: print the magic link so local dev still works.
          async sendVerificationRequest({ identifier, url }: { identifier: string; url: string }) {
            console.log(`\n[auth] magic link for ${identifier}:\n${url}\n`);
          },
        }),
  }),
];
if (googleEnabled) providers.push(Google);
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "Email" } },
      async authorize(c) {
        const email = String(c?.email || "founder@dev.local").toLowerCase();
        let u = one<{ id: string; name: string | null }>(`SELECT id,name FROM users WHERE email=?`, email);
        if (!u) {
          const id = newId();
          run(`INSERT INTO users (id,name,email,email_verified,created_at) VALUES (?,?,?,?,?)`, id, "Dev Founder", email, now(), now());
          u = { id, name: "Dev Founder" };
        }
        return { id: u.id, email, name: u.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: sqliteAdapter(),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  trustHost: true,
  secret: process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "dev-insecure-secret-change-me" : undefined),
  pages: { signIn: "/signin", verifyRequest: "/signin?sent=1" },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});

export interface AppUser {
  id: string;
  name: string | null;
  email: string;
  plan: "free" | "pro";
  register: Register;
  picsAcceptedAt: number | null;
  trainingOptIn: boolean;
}

export async function currentUser(): Promise<AppUser | null> {
  const s = await auth();
  const id = s?.user?.id;
  if (!id) return null;
  const r = one<{ id: string; name: string | null; email: string; plan: string; register: string; pics_accepted_at: number | null; training_opt_in: number }>(
    `SELECT id,name,email,plan,register,pics_accepted_at,training_opt_in FROM users WHERE id=?`, id,
  );
  if (!r) return null;
  return {
    id: r.id, name: r.name, email: r.email, plan: r.plan as AppUser["plan"], register: r.register as Register,
    picsAcceptedAt: r.pics_accepted_at, trainingOptIn: !!r.training_opt_in,
  };
}

/** For pages: signed in AND has accepted the PICS, else redirect. */
export async function requirePageUser(): Promise<AppUser> {
  const u = await currentUser();
  if (!u) redirect("/signin");
  if (!u.picsAcceptedAt) redirect("/welcome");
  return u;
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
}

/** For route handlers. */
export async function requireApiUser(): Promise<AppUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Not signed in", "auth");
  if (!u.picsAcceptedAt) throw new HttpError(403, "Please accept the privacy notice first", "pics");
  return u;
}
