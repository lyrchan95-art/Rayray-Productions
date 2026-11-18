import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { getIdea, getMessage, listMessages, truncateFrom } from "@/lib/repo";
import { runTurn } from "@/lib/skills/engine";
import type { TurnEvent } from "@/lib/types";
import { consumeMessage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  input: z.string().trim().max(8000).optional(),
  forceSkill: z.enum(["prototype-html", "game-prototype", "design-variants", "chat"]).optional(),
  regenerate: z.boolean().optional(),
  editMessageId: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireApiUser();
  const { id } = await params;
  const idea = getIdea(u.id, id);
  if (!idea) throw new HttpError(404, "Not found");
  const body = Body.parse(await req.json());

  let input = body.input ?? "";
  let forceSkill = body.forceSkill;
  if (body.regenerate) {
    const lastUser = [...listMessages(id)].reverse().find((m) => m.role === "user");
    if (!lastUser) throw new HttpError(400, "Nothing to regenerate");
    input = lastUser.content;
    forceSkill ??= lastUser.skill && lastUser.skill !== "idea-capture" ? lastUser.skill : undefined;
    truncateFrom(id, lastUser.id);
  } else if (body.editMessageId) {
    const m = getMessage(id, body.editMessageId);
    if (!m || m.role !== "user") throw new HttpError(400, "Can only edit your own messages");
    truncateFrom(id, m.id);
  }
  if (!input) throw new HttpError(400, "Empty message");
  consumeMessage(u);

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: TurnEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const e of runTurn({ idea, register: u.register, input, forceSkill, signal: req.signal })) send(e);
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new NextResponse(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
});
