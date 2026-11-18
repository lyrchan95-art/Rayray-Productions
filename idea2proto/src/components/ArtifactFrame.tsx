"use client";
import { useEffect, useMemo, useRef } from "react";
import { SHIM_CHANNEL, wrapArtifact } from "@/lib/artifact/runtime";

const storeKey = (id: string) => `i2p:artifact-store:${id}`;

function readSeed(id: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(storeKey(id)) || "{}");
  } catch {
    return {};
  }
}

/**
 * Sandboxed artifact renderer.
 *  sandbox="allow-scripts" only — no allow-same-origin, so the artifact runs in an opaque origin
 *  and can't touch app cookies, storage or APIs. The storage shim inside mirrors its
 *  localStorage writes here; we persist them per idea and seed them back on the next render.
 */
export function ArtifactFrame({ html, storageId, title }: { html: string; storageId: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  // Seed is read once per html change; later writes flow in via postMessage.
  const srcDoc = useMemo(() => wrapArtifact(html, { seed: typeof window === "undefined" ? {} : readSeed(storageId) }), [html, storageId]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data as { channel?: string; type?: string; data?: Record<string, string> };
      if (d?.channel !== SHIM_CHANNEL || d.type !== "set" || typeof d.data !== "object") return;
      try {
        const s = JSON.stringify(d.data);
        if (s.length < 512_000) localStorage.setItem(storeKey(storageId), s);
      } catch {}
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [storageId]);

  return (
    <iframe
      ref={ref}
      className="artifact-frame"
      title={title}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      referrerPolicy="no-referrer"
      allow="autoplay; fullscreen"
    />
  );
}
