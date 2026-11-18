"use client";
import { useCallback, useRef, useState } from "react";

export type RecState = "idle" | "recording" | "busy";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const MAX_MS = 90_000;

/** Tap-to-start / tap-to-stop MediaRecorder wrapper. iOS Safari records audio/mp4. */
export function useRecorder(onAudio: (blob: Blob) => Promise<void> | void) {
  const [state, setState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
    clearInterval(timer.current);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mimeType = MIME_CANDIDATES.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m));
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks, { type: r.mimeType || mimeType || "audio/webm" });
        setState("busy");
        try {
          await onAudio(blob);
        } finally {
          setState("idle");
        }
      };
      rec.current = r;
      r.start();
      setState("recording");
      const t0 = Date.now();
      setElapsed(0);
      timer.current = setInterval(() => {
        const ms = Date.now() - t0;
        setElapsed(ms);
        if (ms > MAX_MS) stop();
      }, 250);
      navigator.vibrate?.(12);
    } catch {
      setError("mic");
      setState("idle");
    }
  }, [onAudio, stop]);

  const toggle = useCallback(() => (state === "recording" ? stop() : state === "idle" ? start() : undefined), [state, start, stop]);
  return { state, error, elapsed, toggle, setState };
}
