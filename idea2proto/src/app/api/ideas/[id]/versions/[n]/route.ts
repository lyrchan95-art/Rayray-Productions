import { NextResponse } from "next/server";
import { requireApiUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { getIdea, getVersion, setCurrentVersion } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string; n: string }> };

async function load({ params }: Ctx) {
  const u = await requireApiUser();
  const { id, n } = await params;
  if (!getIdea(u.id, id)) throw new HttpError(404, "Not found");
  const v = getVersion(id, Number(n));
  if (!v) throw new HttpError(404, "No such version");
  return { id, v };
}

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { v } = await load(ctx);
  return NextResponse.json({ version: v });
});

/** Revert: make this version current. */
export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const { id, v } = await load(ctx);
  setCurrentVersion(id, v.n);
  return NextResponse.json({ version: v });
});
