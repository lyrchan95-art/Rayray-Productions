import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { createIdea, listIdeas } from "@/lib/repo";
import { SpecSchema } from "@/lib/skills/engine";

export const GET = handle(async (req: Request) => {
  const u = await requireApiUser();
  const url = new URL(req.url);
  const ideas = listIdeas(u.id, { q: url.searchParams.get("q") ?? undefined, skill: url.searchParams.get("skill") ?? undefined });
  return NextResponse.json({ ideas });
});

const Body = z.object({
  spec: SpecSchema,
  rawInput: z.string().max(4000).default(""),
  inputMode: z.enum(["voice", "photo", "text"]).default("text"),
});

export const POST = handle(async (req: Request) => {
  const u = await requireApiUser();
  const { spec, rawInput, inputMode } = Body.parse(await req.json());
  const idea = createIdea(u.id, spec, rawInput, inputMode);
  return NextResponse.json({ idea }, { status: 201 });
});
