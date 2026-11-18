import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { structureIdea } from "@/lib/skills/engine";
import { consumeMessage } from "@/lib/usage";

const Body = z.object({ text: z.string().trim().min(2).max(4000) });

export const POST = handle(async (req: Request) => {
  const u = await requireApiUser();
  const { text } = Body.parse(await req.json());
  consumeMessage(u);
  const spec = await structureIdea(text, u.register);
  return NextResponse.json({ spec });
});
