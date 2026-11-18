/** Pull a single-file HTML document out of a model reply. Pure; used server-side and in tests. */
export interface Extracted {
  note: string;
  html: string | null;
}

export function extractArtifact(reply: string): Extracted {
  const fence = reply.match(/```(?:html)?\s*\n([\s\S]*?)(?:\n```|$)/i);
  let html: string | null = null;
  let note = reply;
  if (fence && /<(html|body|!doctype|canvas|div|section)/i.test(fence[1])) {
    html = fence[1].trim();
    note = reply.slice(0, fence.index).trim();
  } else {
    const raw = reply.match(/<!doctype html[\s\S]*?(<\/html>|$)/i) ?? reply.match(/<html[\s\S]*?(<\/html>|$)/i);
    if (raw) {
      html = raw[0].trim();
      note = reply.slice(0, raw.index).trim();
    }
  }
  if (html) html = normalise(html);
  return { note, html };
}

function normalise(html: string): string {
  let h = html;
  if (!/<!doctype/i.test(h)) h = "<!doctype html>\n" + h;
  // Truncated generations: close what we can so the page still renders.
  const opens = (h.match(/<script\b/gi) ?? []).length;
  const closes = (h.match(/<\/script>/gi) ?? []).length;
  if (opens > closes) h += "\n</script>";
  if (!/<\/body>/i.test(h)) h += "\n</body>";
  if (!/<\/html>/i.test(h)) h += "\n</html>";
  if (!/name=["']viewport["']/i.test(h)) {
    h = h.replace(/<head[^>]*>/i, (m) => `${m}\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`);
  }
  return h;
}
