import { NextResponse } from "next/server";
import { requireApiUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { transcribe } from "@/lib/models/stt";

const MAX_BYTES = 10 * 1024 * 1024;

export const POST = handle(async (req: Request) => {
  const u = await requireApiUser();
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) throw new HttpError(400, "No audio");
  if (audio.size > MAX_BYTES) throw new HttpError(413, "Recording too long");
  const lang = u.register === "en" ? "en" : process.env.STT_LANGUAGE || "yue";
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  const result = await transcribe(audio, `speech.${ext}`, lang);
  return NextResponse.json(result);
});
