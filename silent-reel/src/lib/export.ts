import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { FPS, HEIGHT, WIDTH } from "./schema";
import { drawFrame, type RenderInput } from "./renderer";

export interface ExportResult {
  blob: Blob;
  ext: "mp4" | "webm";
  ms: number;
}

const CODECS = ["avc1.640028", "avc1.4d0028", "avc1.42e028", "avc1.640032"];

async function pickCodec(): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of CODECS) {
    for (const hardwareAcceleration of ["prefer-hardware", "prefer-software"] as const) {
      const cfg: VideoEncoderConfig = {
        codec,
        width: WIDTH,
        height: HEIGHT,
        bitrate: 9_000_000,
        framerate: FPS,
        hardwareAcceleration,
        avc: { format: "avc" },
      };
      try {
        const r = await VideoEncoder.isConfigSupported(cfg);
        if (r.supported) return cfg;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

/** Frame-accurate H.264 MP4 via WebCodecs. Falls back to real-time WebM capture. */
export async function exportVideo(
  input: RenderInput,
  onProgress: (frac: number) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const t0 = performance.now();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const total = input.timeline.totalFrames;

  const cfg = await pickCodec();
  if (!cfg) return { ...(await exportWebm(canvas, ctx, input, onProgress, signal)), ms: performance.now() - t0 };

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: WIDTH, height: HEIGHT, frameRate: FPS },
    fastStart: "in-memory",
  });
  let encErr: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encErr = e as Error;
    },
  });
  encoder.configure(cfg);

  const dur = 1_000_000 / FPS;
  for (let f = 0; f < total; f++) {
    if (signal.aborted) {
      encoder.close();
      throw new DOMException("Export cancelled", "AbortError");
    }
    if (encErr) throw encErr;
    drawFrame(ctx, input, f);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(f * dur), duration: Math.round(dur) });
    encoder.encode(frame, { keyFrame: f % (FPS * 2) === 0 });
    frame.close();
    if (encoder.encodeQueueSize > 6) {
      await new Promise<void>((res) => {
        const check = () => (encoder.encodeQueueSize <= 2 ? res() : setTimeout(check, 4));
        check();
      });
    }
    if (f % 6 === 0) {
      onProgress(f / total);
      await new Promise((r) => setTimeout(r, 0)); // let the UI paint
    }
  }
  await encoder.flush();
  if (encErr) throw encErr;
  encoder.close();
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), ext: "mp4", ms: performance.now() - t0 };
}

async function exportWebm(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  onProgress: (f: number) => void,
  signal: AbortSignal,
): Promise<{ blob: Blob; ext: "webm" }> {
  const stream = canvas.captureStream(FPS);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  drawFrame(ctx, input, 0);
  rec.start();
  const total = input.timeline.totalFrames;
  const start = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (signal.aborted) {
        rec.stop();
        return reject(new DOMException("Export cancelled", "AbortError"));
      }
      const f = Math.floor(((performance.now() - start) / 1000) * FPS);
      if (f >= total) return resolve();
      drawFrame(ctx, input, f);
      onProgress(f / total);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await done;
  onProgress(1);
  return { blob: new Blob(chunks, { type: "video/webm" }), ext: "webm" };
}
