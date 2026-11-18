import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, HttpError, signOut } from "@/lib/auth";
import { run, now } from "@/lib/db";
import { handle } from "@/lib/http";
import { publishStore } from "@/lib/publish/store";
import { deleteUser, userPublicationSlugs } from "@/lib/repo";
import { dailyLimit, usageToday } from "@/lib/usage";

async function me() {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Not signed in", "auth");
  return u;
}

export const GET = handle(async () => {
  const u = await me();
  return NextResponse.json({ user: u, usage: { used: usageToday(u.id), limit: dailyLimit(u) } });
});

const Patch = z.object({
  register: z.enum(["yue", "en", "mixed"]).optional(),
  acceptPics: z.literal(true).optional(),
  trainingOptIn: z.boolean().optional(),
  name: z.string().max(80).optional(),
});

export const PATCH = handle(async (req: Request) => {
  const u = await me();
  const b = Patch.parse(await req.json());
  if (b.register) run(`UPDATE users SET register=? WHERE id=?`, b.register, u.id);
  if (b.acceptPics) run(`UPDATE users SET pics_accepted_at=? WHERE id=?`, now(), u.id);
  if (b.trainingOptIn !== undefined) run(`UPDATE users SET training_opt_in=? WHERE id=?`, b.trainingOptIn ? 1 : 0, u.id);
  if (b.name !== undefined) run(`UPDATE users SET name=? WHERE id=?`, b.name, u.id);
  return NextResponse.json({ user: await currentUser() });
});

/** Account deletion: removes published files, then every row (FK cascade). */
export const DELETE = handle(async () => {
  const u = await me();
  const store = publishStore();
  await Promise.all(userPublicationSlugs(u.id).map((s) => store.remove(s).catch(() => {})));
  deleteUser(u.id);
  await signOut({ redirect: false });
  return new NextResponse(null, { status: 204 });
});
