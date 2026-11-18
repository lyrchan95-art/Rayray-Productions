import { NextResponse } from "next/server";
import { requireApiUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { publishStore } from "@/lib/publish/store";
import { activePublication, deleteIdea, getIdea, listMessages, listVersions, updateSpec } from "@/lib/repo";
import { SpecSchema } from "@/lib/skills/engine";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireApiUser();
  const { id } = await params;
  const idea = getIdea(u.id, id);
  if (!idea) throw new HttpError(404, "Not found");
  return NextResponse.json({ idea, messages: listMessages(id), versions: listVersions(id), publication: activePublication(id) });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireApiUser();
  const { id } = await params;
  if (!getIdea(u.id, id)) throw new HttpError(404, "Not found");
  const { spec } = await req.json();
  updateSpec(u.id, id, SpecSchema.parse(spec));
  return NextResponse.json({ idea: getIdea(u.id, id) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireApiUser();
  const { id } = await params;
  if (!getIdea(u.id, id)) throw new HttpError(404, "Not found");
  const pub = activePublication(id);
  if (pub) await publishStore().remove(pub.slug);
  deleteIdea(u.id, id);
  return new NextResponse(null, { status: 204 });
});
