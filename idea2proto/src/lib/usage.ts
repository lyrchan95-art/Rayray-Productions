import "server-only";
import { one, run } from "./db";
import { HttpError, type AppUser } from "./auth";

const hkDay = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // resets at HKT midnight

export const dailyLimit = (u: Pick<AppUser, "plan">) =>
  u.plan === "pro" ? Number(process.env.PRO_DAILY_MESSAGES || 300) : Number(process.env.FREE_DAILY_MESSAGES || 20);

export function usageToday(userId: string): number {
  return one<{ count: number }>(`SELECT count FROM usage WHERE user_id=? AND day=?`, userId, hkDay())?.count ?? 0;
}

/** Throws 402 when the user is out of messages for today; otherwise records one. */
export function consumeMessage(u: AppUser) {
  const used = usageToday(u.id);
  if (used >= dailyLimit(u)) throw new HttpError(402, "Daily limit reached", "limit");
  run(
    `INSERT INTO usage (user_id,day,count) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1`,
    u.id, hkDay(),
  );
}

export const canPublish = (u: AppUser) => u.plan === "pro" || process.env.FREE_CAN_PUBLISH === "1";
