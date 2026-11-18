import { ARTIFACT_CSP } from "@/lib/artifact/runtime";
import { readLocal } from "@/lib/publish/store";
import { publicationBySlug } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * Public prototype pages (local store). The CSP `sandbox` directive gives the page an opaque
 * origin even at top level, so artifact code can never read app cookies or call app APIs.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pub = publicationBySlug(slug);
  const html = pub && !pub.revokedAt ? await readLocal(slug) : null;
  if (!html) {
    return new Response("<!doctype html><meta name=viewport content='width=device-width'><title>Not found</title><p style='font:16px system-ui;padding:24px'>This prototype is no longer published.</p>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": `${ARTIFACT_CSP}; sandbox allow-scripts allow-popups`,
      "cache-control": "no-cache", // revalidate every load so a revoke takes effect immediately
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
