import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireApiUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { newSlug, publishedDocument, publishStore } from "@/lib/publish/store";
import { activePublication, getIdea, upsertPublication, getVersion, revokePublication } from "@/lib/repo";
import { canPublish } from "@/lib/usage";

type Ctx = { params: Promise<{ id: string }> };

const withQr = async (url: string) => ({ url, qr: await QRCode.toDataURL(url, { margin: 1, width: 480 }) });

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireApiUser();
  const { id } = await params;
  if (!getIdea(u.id, id)) throw new HttpError(404, "Not found");
  const pub = activePublication(id);
  return NextResponse.json({ publication: pub ? { ...pub, ...(await withQr(pub.url)) } : null });
});

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireApiUser();
  const { id } = await params;
  const idea = getIdea(u.id, id);
  if (!idea) throw new HttpError(404, "Not found");
  if (!canPublish(u)) throw new HttpError(402, "Publishing is a Pro feature", "pro");
  if (!idea.currentVersion) throw new HttpError(400, "Nothing to publish yet");
  const v = getVersion(id, idea.currentVersion)!;

  // Republishing replaces the content behind the same link.
  const slug = activePublication(id)?.slug ?? newSlug();
  const url = await publishStore().put(slug, publishedDocument(v.html));
  upsertPublication(id, slug, v.n, url);
  return NextResponse.json({ publication: { ...activePublication(id)!, ...(await withQr(url)) } });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireApiUser();
  const { id } = await params;
  if (!getIdea(u.id, id)) throw new HttpError(404, "Not found");
  const pub = activePublication(id);
  if (pub) {
    await publishStore().remove(pub.slug);
    revokePublication(pub.slug);
  }
  return new NextResponse(null, { status: 204 });
});
