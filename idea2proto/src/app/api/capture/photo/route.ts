import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { structureFromPhoto } from "@/lib/skills/engine";
import { consumeMessage } from "@/lib/usage";

const Body = z.object({
  image: z.string().regex(/^data:image\/(png|jpe?g|webp|heic);base64,/).max(8_000_000),
  note: z.string().max(500).default(""),
});

export const POST = handle(async (req: Request) => {
  const u = await requireApiUser();
  const { image, note } = Body.parse(await req.json());
  consumeMessage(u);
  const spec = await structureFromPhoto(image, note, u.register);
  return NextResponse.json({ spec });
});
