import {
  CAMERA_MOVES,
  DURATION_SEC,
  FPS,
  SCHEMA_PROMPT,
  SCHEMA_VERSION,
  TEXT_ANIMATIONS,
  VideoScriptSchema,
  formatIssues,
  type Scene,
  type VideoScript,
} from "./schema";

export type FontPref = VideoScript["brand"]["font"];

export interface BriefForm {
  goal: string;
  tone: string;
  audience: string;
  message: string;
  cta: string;
  color: string;
  font: FontPref;
}

export type AgentLog = { kind: "info" | "warn" | "error"; text: string };

export interface AgentResult {
  script: VideoScript;
  source: "claude" | "claude-repaired" | "template";
  log: AgentLog[];
}

// ---------------------------------------------------------------------------
// Claude, via the artifact's `sample` capability
// ---------------------------------------------------------------------------

type SampleFn = {
  (input: unknown, opts?: Record<string, unknown>): Promise<{ text: string }>;
  json: <T = unknown>(input: unknown, opts?: Record<string, unknown>) => Promise<T>;
  limits: () => Promise<{ images?: { maxCount: number; maxBytes: number; mediaTypes: string[] } }>;
};

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<unknown> };
  }
}

let samplePromise: Promise<SampleFn | null> | null = null;
export function getSample(): Promise<SampleFn | null> {
  if (!samplePromise) {
    samplePromise = window.claude?.use
      ? (window.claude.use("sample") as Promise<SampleFn | null>).catch(() => null)
      : Promise.resolve(null);
  }
  return samplePromise;
}

function buildPrompt(form: BriefForm): string {
  return `You are the script agent for a SILENT 15-second Instagram Reel (9:16, no audio, no music).
A single photo is attached. Study it: find the subject and where it sits in the frame (focus x/y, 0..1).

Write a VideoScript as JSON ONLY, matching this schema exactly:
${SCHEMA_PROMPT}

Silent-first rules:
- Pacing comes only from motion and text. Scene cadence 1.5–2.5s. The hook scene is the shortest and hits in the first second; use "punch-in" or "split-reveal" for it.
- Vary text animations between scenes; never use the same animation three times in a row. "word-by-word" and "typewriter" give rhythm.
- Every scene has a camera move; alternate directions so it feels like edited coverage of one photo. Keep focus on the subject.
- Place text where it will not cover the subject (if the subject is low in the frame, put text at top, and vice versa).
- Copy must be short and scannable: hook <= 5 words, other lines <= 8 words. No hashtags, no emoji.
- The final scene's text is the call to action, role "cta".
- Do not decide colors for legibility; the renderer handles contrast. Only use brand.color and brand.font as given.

Brief from the user:
- Goal: ${form.goal}
- Tone: ${form.tone}
- Audience: ${form.audience}
- Key message: ${form.message}
- Call to action: ${form.cta}
- Brand color: ${form.color}
- Font: ${form.font}

Reply with only the JSON object.`;
}

async function imageToJpegBlob(img: HTMLImageElement | HTMLCanvasElement, maxSide = 1024): Promise<Blob> {
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.85));
}

export async function generateScript(
  form: BriefForm,
  image: HTMLImageElement | HTMLCanvasElement,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const log: AgentLog[] = [];
  const sample = await getSample();
  if (!sample) {
    log.push({ kind: "warn", text: "Claude isn't available in this view, so the built-in template wrote the script." });
    return { script: templateScript(form), source: "template", log };
  }

  let images: Blob[] | undefined;
  try {
    const lim = await sample.limits().catch(() => null);
    if (lim?.images) images = [await imageToJpegBlob(image)];
    else log.push({ kind: "warn", text: "Image sending isn't allowed here, so Claude is writing from the brief only." });
  } catch {
    /* text-only */
  }

  const prompt = buildPrompt(form);
  let raw: unknown;
  try {
    log.push({ kind: "info", text: "Asked Claude for a script." });
    raw = await sample.json(prompt, { images, signal, cache: false });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "cancelled") throw e;
    log.push({ kind: "error", text: `Claude call failed (${code ?? "error"}). Used the built-in template.` });
    return { script: templateScript(form), source: "template", log };
  }

  let parsed = VideoScriptSchema.safeParse(forceFixed(raw, form));
  if (parsed.success) {
    log.push({ kind: "info", text: "Script passed schema validation." });
    return { script: parsed.data, source: "claude", log };
  }

  // One repair round: send the validator's own words back.
  const issues = formatIssues(parsed.error);
  log.push({ kind: "warn", text: `Validation failed on ${issues.length} rule(s); asking Claude to fix them.` });
  try {
    const fixed = await sample.json(
      `${prompt}\n\nYour previous reply was:\n${JSON.stringify(raw)}\n\nIt failed validation:\n- ${issues.join(
        "\n- ",
      )}\n\nReturn the corrected JSON object only.`,
      { images, signal, cache: false },
    );
    parsed = VideoScriptSchema.safeParse(forceFixed(fixed, form));
    if (parsed.success) {
      log.push({ kind: "info", text: "Repaired script passed validation." });
      return { script: parsed.data, source: "claude-repaired", log };
    }
    // Last resort before the template: deterministic timing normalization.
    const norm = VideoScriptSchema.safeParse(normalizeTimings(forceFixed(fixed, form)));
    if (norm.success) {
      log.push({ kind: "warn", text: "Rescaled scene timings to hit exactly 15s." });
      return { script: norm.data, source: "claude-repaired", log };
    }
    log.push({ kind: "error", text: `Still invalid: ${formatIssues(norm.error).slice(0, 3).join("; ")}. Used the template.` });
  } catch (e) {
    if ((e as { code?: string }).code === "cancelled") throw e;
    log.push({ kind: "error", text: "Repair call failed. Used the built-in template." });
  }
  return { script: templateScript(form), source: "template", log };
}

/** Fields the user owns are never left to the model. */
function forceFixed(raw: unknown, form: BriefForm): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  return { ...r, schemaVersion: SCHEMA_VERSION, fps: FPS, durationSec: DURATION_SEC, brand: { color: form.color, font: form.font } };
}

function normalizeTimings(raw: unknown): unknown {
  const r = raw as { scenes?: { duration?: number }[] };
  if (!r || !Array.isArray(r.scenes) || r.scenes.length < 6) return raw;
  const n = r.scenes.length;
  // Distribute 15s: hook gets 1.6s, the rest split evenly, all clamped and rounded to frames.
  const hook = 1.6;
  const rest = (DURATION_SEC - hook) / (n - 1);
  if (rest < 1.5 || rest > 2.5) return raw;
  const durs = [hook, ...Array(n - 1).fill(rest)].map((d) => Math.round(d * FPS) / FPS);
  const drift = DURATION_SEC - durs.reduce((a, b) => a + b, 0);
  durs[n - 1] = Math.round((durs[n - 1] + drift) * FPS) / FPS;
  return { ...r, scenes: r.scenes.map((s, i) => ({ ...s, duration: durs[i] })) };
}

// ---------------------------------------------------------------------------
// Deterministic template: used when Claude is unavailable, and for the sample.
// ---------------------------------------------------------------------------

function words(s: string, max: number): string {
  const w = s.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const out = w.slice(0, max).join(" ");
  return out.length > 60 ? out.slice(0, 57).trimEnd() + "…" : out;
}

function chunk(s: string, size: number): string[] {
  const w = s.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(" "));
  return out;
}

export function templateScript(form: BriefForm): VideoScript {
  const msgParts = chunk(form.message || "Made with care", 5).slice(0, 3);
  const lines: { content: string; role: Scene["text"]["role"] }[] = [
    { content: words(form.goal || "Look closer", 4), role: "hook" },
    ...msgParts.map((p) => ({ content: words(p, 8), role: "body" as const })),
    { content: words(`For ${form.audience || "you"}`, 6), role: "detail" },
    { content: words(form.tone ? `${form.tone}, by design` : "Clean by design", 6), role: "detail" },
    { content: words(form.cta || "Learn more", 6), role: "cta" },
  ];
  while (lines.length < 7) lines.splice(lines.length - 1, 0, { content: "Every detail considered", role: "detail" });

  const n = lines.length;
  const hook = 1.6;
  const rest = (DURATION_SEC - hook) / (n - 1);
  const durs = [hook, ...Array(n - 1).fill(rest)].map((d) => Math.round(d * FPS) / FPS);
  durs[n - 1] = Math.round((durs[n - 1] + (DURATION_SEC - durs.reduce((a, b) => a + b, 0))) * FPS) / FPS;

  const moves = ["push-in", "pan-right", "rise", "pan-left", "pull-out", "drift", "push-in", "pan-right"] as const;
  const anims = ["punch-in", "word-by-word", "typewriter", "rise", "split-reveal", "word-by-word", "rise", "punch-in"] as const;
  // Product photos usually have the subject mid-frame, so text alternates top/bottom.
  const positions = ["top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom"] as const;
  const transitions = ["cut", "flash", "crossfade", "zoom-through", "crossfade", "cut", "flash", "zoom-through"] as const;
  const focuses = [
    { x: 0.5, y: 0.5 },
    { x: 0.42, y: 0.45 },
    { x: 0.58, y: 0.55 },
    { x: 0.5, y: 0.4 },
    { x: 0.45, y: 0.6 },
    { x: 0.55, y: 0.5 },
    { x: 0.5, y: 0.52 },
    { x: 0.5, y: 0.5 },
  ];

  const script: VideoScript = {
    schemaVersion: SCHEMA_VERSION,
    title: words(form.message || form.goal || "Silent reel", 10),
    fps: FPS,
    durationSec: DURATION_SEC,
    brand: { color: form.color, font: form.font },
    scenes: lines.map((l, i) => {
      const firstWord = l.content.split(" ").sort((a, b) => b.length - a.length)[0]?.replace(/[^\p{L}\p{N}'-]/gu, "");
      return {
        id: `s${i + 1}`,
        duration: durs[i],
        camera: { move: moves[i % moves.length], focus: focuses[i % focuses.length], intensity: i === 0 ? 0.9 : 0.6 },
        text: {
          content: l.content,
          role: l.role,
          animation: l.role === "cta" ? "rise" : anims[i % anims.length],
          position: l.role === "cta" ? "center" : positions[i % positions.length],
          ...(firstWord && firstWord.length > 3 && l.role !== "cta" && i % 2 === 0 ? { emphasis: firstWord } : {}),
        },
        transitionIn: i === 0 ? "cut" : transitions[i % transitions.length],
      };
    }),
  };
  const ok = VideoScriptSchema.safeParse(script);
  if (!ok.success) throw new Error("Template produced an invalid script: " + formatIssues(ok.error).join("; "));
  return ok.data;
}

export { CAMERA_MOVES, TEXT_ANIMATIONS };
