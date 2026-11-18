import "server-only";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { newId, now, one, run } from "../db";

type UserRow = { id: string; name: string | null; email: string; email_verified: number | null; image: string | null };
const toUser = (r: UserRow): AdapterUser => ({
  id: r.id,
  name: r.name,
  email: r.email,
  emailVerified: r.email_verified ? new Date(r.email_verified) : null,
  image: r.image,
});

/** Minimal Auth.js adapter on node:sqlite (JWT sessions, so no sessions table). */
export function sqliteAdapter(): Adapter {
  return {
    async createUser(u) {
      const id = newId();
      run(
        `INSERT INTO users (id,name,email,email_verified,image,created_at) VALUES (?,?,?,?,?,?)`,
        id, u.name ?? null, u.email.toLowerCase(), u.emailVerified ? +u.emailVerified : null, u.image ?? null, now(),
      );
      return toUser(one<UserRow>(`SELECT * FROM users WHERE id=?`, id)!);
    },
    async getUser(id) {
      const r = one<UserRow>(`SELECT * FROM users WHERE id=?`, id);
      return r ? toUser(r) : null;
    },
    async getUserByEmail(email) {
      const r = one<UserRow>(`SELECT * FROM users WHERE email=?`, email.toLowerCase());
      return r ? toUser(r) : null;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const r = one<UserRow>(
        `SELECT u.* FROM users u JOIN accounts a ON a.user_id=u.id WHERE a.provider=? AND a.provider_account_id=?`,
        provider, providerAccountId,
      );
      return r ? toUser(r) : null;
    },
    async updateUser(u) {
      const cur = one<UserRow>(`SELECT * FROM users WHERE id=?`, u.id)!;
      run(
        `UPDATE users SET name=?, email=?, email_verified=?, image=? WHERE id=?`,
        u.name ?? cur.name, (u.email ?? cur.email).toLowerCase(),
        u.emailVerified ? +u.emailVerified : cur.email_verified, u.image ?? cur.image, u.id,
      );
      return toUser(one<UserRow>(`SELECT * FROM users WHERE id=?`, u.id)!);
    },
    async deleteUser(id) {
      run(`DELETE FROM users WHERE id=?`, id);
    },
    async linkAccount(a) {
      run(
        `INSERT OR IGNORE INTO accounts (user_id,type,provider,provider_account_id) VALUES (?,?,?,?)`,
        a.userId, a.type, a.provider, a.providerAccountId,
      );
    },
    async unlinkAccount({ provider, providerAccountId }) {
      run(`DELETE FROM accounts WHERE provider=? AND provider_account_id=?`, provider, providerAccountId);
    },
    async createVerificationToken(t) {
      run(`INSERT INTO verification_tokens (identifier,token,expires) VALUES (?,?,?)`, t.identifier, t.token, +t.expires);
      return t;
    },
    async useVerificationToken({ identifier, token }) {
      const r = one<{ identifier: string; token: string; expires: number }>(
        `SELECT * FROM verification_tokens WHERE identifier=? AND token=?`, identifier, token,
      );
      if (!r) return null;
      run(`DELETE FROM verification_tokens WHERE identifier=? AND token=?`, identifier, token);
      return { identifier: r.identifier, token: r.token, expires: new Date(r.expires) };
    },
  };
}
