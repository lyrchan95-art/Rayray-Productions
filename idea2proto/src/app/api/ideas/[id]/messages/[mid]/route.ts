import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { getIdea, setFeedback } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string; mid: string }> };
const Body = z.object({ feedback: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireApiUser();
  const { id, mid } = await params;
  if (!getIdea(u.id, id)) throw new HttpError(404, "Not found");
  setFeedback(id, mid, Body.parse(await req.json()).feedback);
  return NextResponse.json({ ok: true });
});
