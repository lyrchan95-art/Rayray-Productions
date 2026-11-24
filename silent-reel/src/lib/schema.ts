import { z } from "zod";

/**
 * VideoScript v1 — the only thing the script agent is allowed to produce.
 * The renderer consumes this and nothing else. Bump SCHEMA_VERSION on any
 * breaking change so old scripts keep rendering the way they did.
 */
export const SCHEMA_VERSION = "1.0" as const;
export const FPS = 30;
export const DURATION_SEC = 15;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const CAMERA_MOVES = ["push-in", "pull-out", "pan-left", "pan-right", "rise", "drift"] as const;
export const TEXT_ANIMATIONS = ["word-by-word", "punch-in", "typewriter", "rise", "split-reveal"] as const;
export const TEXT_ROLES = ["hook", "body", "detail", "cta"] as const;
export const POSITIONS = ["top", "center", "bottom"] as const;
export const TRANSITIONS = ["cut", "crossfade", "flash", "zoom-through"] as const;

const Focus = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const SceneSchema = z.object({
  id: z.string().min(1).max(24),
  duration: z.number().min(1.5).max(2.5),
  camera: z.object({
    move: z.enum(CAMERA_MOVES),
    focus: Focus, // point of interest, 0..1 in image space
    intensity: z.number().min(0).max(1),
  }),
  text: z.object({
    content: z.string().min(1).max(60),
    role: z.enum(TEXT_ROLES),
    animation: z.enum(TEXT_ANIMATIONS),
    position: z.enum(POSITIONS),
    emphasis: z.string().max(30).optional(), // a word inside content to tint with the brand color
  }),
  transitionIn: z.enum(TRANSITIONS),
});

export const VideoScriptSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    title: z.string().min(1).max(80),
    fps: z.literal(FPS),
    durationSec: z.literal(DURATION_SEC),
    brand: z.object({
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      font: z.enum(["grotesk", "serif", "condensed", "mono"]),
    }),
    scenes: z.array(SceneSchema).min(6).max(10),
  })
  .superRefine((s, ctx) => {
    const total = s.scenes.reduce((a, sc) => a + sc.duration, 0);
    if (Math.abs(total - DURATION_SEC) > 0.05) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenes"],
        message: `Scene durations must sum to ${DURATION_SEC}s (got ${total.toFixed(2)}s)`,
      });
    }
    if (s.scenes[0] && s.scenes[0].duration > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenes", 0, "duration"],
        message: "The hook scene must be 2s or shorter",
      });
    }
    if (s.scenes[0] && s.scenes[0].text.role !== "hook") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", 0, "text", "role"], message: "First scene must be the hook" });
    }
    const last = s.scenes[s.scenes.length - 1];
    if (last && last.text.role !== "cta") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", s.scenes.length - 1, "text", "role"], message: "Last scene must be the CTA" });
    }
    const ids = new Set<string>();
    s.scenes.forEach((sc, i) => {
      if (ids.has(sc.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", i, "id"], message: "Duplicate scene id" });
      ids.add(sc.id);
      if (sc.text.emphasis && !sc.text.content.toLowerCase().includes(sc.text.emphasis.toLowerCase())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", i, "text", "emphasis"], message: "Emphasis must be a word from content" });
      }
    });
  });

export type VideoScript = z.infer<typeof VideoScriptSchema>;
export type Scene = z.infer<typeof SceneSchema>;

export function formatIssues(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

/** Human-readable schema description handed to the script agent. */
export const SCHEMA_PROMPT = `{
  "schemaVersion": "1.0",
  "title": string (<=80 chars),
  "fps": 30,
  "durationSec": 15,
  "brand": { "color": "#RRGGBB", "font": "grotesk" | "serif" | "condensed" | "mono" },
  "scenes": [            // 6 to 10 scenes, durations MUST sum to exactly 15
    {
      "id": string (short, unique, e.g. "s1"),
      "duration": number 1.5..2.5 (first scene <= 2),
      "camera": {
        "move": ${CAMERA_MOVES.map((m) => `"${m}"`).join(" | ")},
        "focus": { "x": 0..1, "y": 0..1 },   // where the subject is in the photo
        "intensity": 0..1
      },
      "text": {
        "content": string (<=60 chars; hook <=5 words, others <=8 words),
        "role": ${TEXT_ROLES.map((m) => `"${m}"`).join(" | ")},   // first = "hook", last = "cta"
        "animation": ${TEXT_ANIMATIONS.map((m) => `"${m}"`).join(" | ")},
        "position": "top" | "center" | "bottom",
        "emphasis": optional single word copied from content
      },
      "transitionIn": ${TRANSITIONS.map((m) => `"${m}"`).join(" | ")}
    }
  ]
}`;
