import { FPS, HEIGHT, WIDTH, type Scene, type VideoScript } from "./schema";

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export const FONT_FAMILIES: Record<VideoScript["brand"]["font"], { family: string; weight: number; upper: boolean; tracking: number; label: string }> = {
  grotesk: { family: "'Schibsted Grotesk', 'Helvetica Neue', Arial, sans-serif", weight: 800, upper: false, tracking: -0.025, label: "Grotesk" },
  serif: { family: "'Fraunces', Georgia, 'Times New Roman', serif", weight: 600, upper: false, tracking: -0.02, label: "Serif" },
  condensed: { family: "'Anton', 'Impact', 'Arial Narrow', sans-serif", weight: 400, upper: true, tracking: 0.01, label: "Condensed" },
  mono: { family: "'JetBrains Mono', 'Courier New', monospace", weight: 700, upper: false, tracking: -0.04, label: "Mono" },
};

export async function loadRenderFonts(): Promise<void> {
  if (!document.fonts) return;
  await Promise.all(
    Object.values(FONT_FAMILIES).map((f) =>
      document.fonts.load(`${f.weight} 64px ${f.family}`).catch(() => undefined),
    ),
  );
}

// ---------------------------------------------------------------------------
// Image analysis → legibility. The LLM never decides contrast.
// ---------------------------------------------------------------------------

export type Band = "top" | "center" | "bottom";
export interface BandStats {
  mean: number; // relative luminance 0..1
  p15: number;
  p85: number;
  busy: number; // std dev of luminance
}
export interface Legibility {
  text: "light" | "dark";
  textColor: string;
  scrimColor: string;
  scrimAlpha: number;
  shadow: boolean;
  contrast: number; // estimated worst-case contrast after scrim
}
export type ImageAnalysis = Record<Band, BandStats & { legibility: Legibility }>;

const BAND_RANGES: Record<Band, [number, number]> = {
  top: [0.1, 0.36],
  center: [0.36, 0.64],
  bottom: [0.62, 0.9],
};

function srgbToLin(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
export function relLum(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
export function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
export function hexLum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return relLum((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

const TARGET = 4.8; // a little over WCAG AA for large text over moving imagery
const LIGHT_TEXT = 1.0;
const DARK_TEXT = 0.012; // #1a1a1a-ish

function solveLegibility(s: BandStats): Legibility {
  // Pick the text polarity that needs the least help.
  const lightWorst = contrast(LIGHT_TEXT, s.p85);
  const darkWorst = contrast(DARK_TEXT, s.p15);
  const light = lightWorst >= darkWorst * 0.85; // slight bias toward light text: it reads more "premium" on photos
  const textL = light ? LIGHT_TEXT : DARK_TEXT;
  const scrimL = light ? 0 : 1;
  const worstBg = light ? s.p85 : s.p15;

  // Solve for scrim alpha so blended background hits TARGET contrast.
  // blended = bg*(1-a) + scrimL*a
  let a = 0;
  const needBg = light ? (textL + 0.05) / TARGET - 0.05 : TARGET * (textL + 0.05) - 0.05;
  if (light && worstBg > needBg) a = (worstBg - needBg) / (worstBg - scrimL);
  if (!light && worstBg < needBg) a = (needBg - worstBg) / (scrimL - worstBg);
  // Busy backgrounds get extra help even when the average passes.
  a = a + s.busy * 0.6;
  a = Math.max(light ? 0.18 : 0.12, Math.min(0.82, a));
  const blended = worstBg * (1 - a) + scrimL * a;
  return {
    text: light ? "light" : "dark",
    textColor: light ? "#ffffff" : "#141414",
    scrimColor: light ? "8,8,10" : "250,249,246",
    scrimAlpha: a,
    shadow: light,
    contrast: contrast(textL, blended),
  };
}

export function analyzeImage(img: CanvasImageSource & { width: number; height: number }): ImageAnalysis {
  const W = 108,
    H = 192;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const { sw, sh } = naturalSize(img);
  const s = Math.max(W / sw, H / sh);
  ctx.drawImage(img, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
  const data = ctx.getImageData(0, 0, W, H).data;
  const out = {} as ImageAnalysis;
  (Object.keys(BAND_RANGES) as Band[]).forEach((band) => {
    const [y0, y1] = BAND_RANGES[band];
    const vals: number[] = [];
    for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        vals.push(relLum(data[i], data[i + 1], data[i + 2]));
      }
    }
    vals.sort((a, b) => a - b);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    const stats: BandStats = { mean, p15: vals[Math.floor(vals.length * 0.15)], p85: vals[Math.floor(vals.length * 0.85)], busy: sd };
    out[band] = { ...stats, legibility: solveLegibility(stats) };
  });
  return out;
}

function naturalSize(img: CanvasImageSource & { width: number; height: number }) {
  if (img instanceof HTMLImageElement) return { sw: img.naturalWidth, sh: img.naturalHeight };
  return { sw: img.width, sh: img.height };
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

export interface Timeline {
  starts: number[]; // seconds
  totalFrames: number;
}
export function buildTimeline(script: VideoScript): Timeline {
  const starts: number[] = [];
  let t = 0;
  for (const s of script.scenes) {
    starts.push(t);
    t += s.duration;
  }
  return { starts, totalFrames: Math.round(script.durationSec * FPS) };
}
export function sceneAt(script: VideoScript, tl: Timeline, t: number): number {
  for (let i = script.scenes.length - 1; i >= 0; i--) if (t >= tl.starts[i]) return i;
  return 0;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const easeOutBack = (x: number) => {
  const c1 = 1.5,
    c3 = c1 + 1;
  const v = clamp01(x) - 1;
  return 1 + c3 * v * v * v + c1 * v * v;
};
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(x)));

// ---------------------------------------------------------------------------
// Camera: Ken Burns + global drift. Motion on every frame.
// ---------------------------------------------------------------------------

interface Cam {
  scale: number; // multiplier on cover scale
  cx: number; // crop centre in image space, 0..1
  cy: number;
}

function cameraFor(scene: Scene, p: number, globalT: number): Cam {
  const k = 0.06 + 0.14 * scene.camera.intensity;
  const e = easeInOutSine(Math.max(-0.3, Math.min(1.3, p)));
  const f = scene.camera.focus;
  let scale = 1.08,
    dx = 0,
    dy = 0;
  switch (scene.camera.move) {
    case "push-in":
      scale = 1.08 + k * e;
      break;
    case "pull-out":
      scale = 1.08 + k * (1 - e);
      break;
    case "pan-left":
      scale = 1.16 + k * 0.3;
      dx = (0.5 - e) * k * 0.9;
      break;
    case "pan-right":
      scale = 1.16 + k * 0.3;
      dx = (e - 0.5) * k * 0.9;
      break;
    case "rise":
      scale = 1.14 + k * 0.4 * e;
      dy = (0.5 - e) * k * 0.8;
      break;
    case "drift":
      scale = 1.12 + k * 0.25 * e;
      dx = Math.sin(e * Math.PI) * k * 0.25;
      dy = (0.5 - e) * k * 0.25;
      break;
  }
  // Slow global drift so even cuts feel continuous.
  const gdx = Math.sin(globalT * 0.7) * 0.006;
  const gdy = Math.cos(globalT * 0.53) * 0.005;
  // Bias crop toward focus but not all the way (keeps composition natural).
  const cx = 0.5 + (f.x - 0.5) * 0.65 + dx + gdx;
  const cy = 0.5 + (f.y - 0.5) * 0.65 + dy + gdy;
  return { scale: scale + Math.sin(globalT * 0.9) * 0.004, cx, cy };
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, cam: Cam) {
  const { sw, sh } = naturalSize(img);
  const cover = Math.max(WIDTH / sw, HEIGHT / sh);
  const s = cover * cam.scale;
  const dw = sw * s,
    dh = sh * s;
  // Clamp so the image always covers the frame.
  let x = WIDTH / 2 - cam.cx * dw;
  let y = HEIGHT / 2 - cam.cy * dh;
  x = Math.min(0, Math.max(WIDTH - dw, x));
  y = Math.min(0, Math.max(HEIGHT - dh, y));
  ctx.drawImage(img, x, y, dw, dh);
}

// ---------------------------------------------------------------------------
// Text layout
// ---------------------------------------------------------------------------

interface Word {
  text: string;
  x: number; // left, relative to block left
  w: number;
  line: number;
  emph: boolean;
  charStart: number; // index in the whole string, for typewriter
}
interface Layout {
  words: Word[];
  lines: { y: number; w: number }[];
  size: number;
  lineH: number;
  blockW: number;
  blockH: number;
}

const ROLE_SIZE: Record<Scene["text"]["role"], number> = { hook: 138, body: 98, detail: 86, cta: 82 };

function fontString(script: VideoScript, size: number) {
  const f = FONT_FAMILIES[script.brand.font];
  return `${f.weight} ${size}px ${f.family}`;
}

function setTracking(ctx: CanvasRenderingContext2D, script: VideoScript, size: number) {
  const f = FONT_FAMILIES[script.brand.font];
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${(f.tracking * size).toFixed(1)}px`;
}

const layoutCache = new Map<string, Layout>();

function layoutText(ctx: CanvasRenderingContext2D, script: VideoScript, scene: Scene, maxW: number): Layout {
  const f = FONT_FAMILIES[script.brand.font];
  const content = f.upper ? scene.text.content.toUpperCase() : scene.text.content;
  const key = `${script.brand.font}|${scene.text.role}|${content}|${scene.text.emphasis ?? ""}|${maxW}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;

  let size = ROLE_SIZE[scene.text.role] * (f.upper ? 1.08 : 1);
  const emph = scene.text.emphasis?.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "");
  const tokens = content.split(/\s+/).filter(Boolean);

  for (let attempt = 0; attempt < 8; attempt++) {
    ctx.font = fontString(script, size);
    setTracking(ctx, script, size);
    const space = ctx.measureText(" ").width;
    const lineH = size * (f.upper ? 1.02 : 1.08);
    const words: Word[] = [];
    const lines: { y: number; w: number }[] = [];
    let line = 0,
      x = 0,
      charPos = 0,
      tooWide = false;
    for (const t of tokens) {
      const w = ctx.measureText(t).width;
      if (w > maxW) tooWide = true;
      if (x > 0 && x + w > maxW) {
        lines.push({ y: line * lineH, w: x - space });
        line++;
        x = 0;
      }
      words.push({ text: t, x, w, line, emph: !!emph && t.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "") === emph, charStart: charPos });
      x += w + space;
      charPos += t.length + 1;
    }
    lines.push({ y: line * lineH, w: x - space });
    if ((tooWide || lines.length > 3) && attempt < 7) {
      size *= 0.9;
      continue;
    }
    const blockW = Math.max(...lines.map((l) => l.w));
    const out = { words, lines, size, lineH, blockW, blockH: lines.length * lineH };
    layoutCache.set(key, out);
    return out;
  }
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

export interface RenderInput {
  script: VideoScript;
  timeline: Timeline;
  image: CanvasImageSource & { width: number; height: number };
  analysis: ImageAnalysis;
}

const TRANSITION_SEC = 0.32;
const EXIT_SEC = 0.2;

export function drawFrame(ctx: CanvasRenderingContext2D, input: RenderInput, frame: number) {
  const { script, timeline, image } = input;
  const t = frame / FPS;
  const i = sceneAt(script, timeline, t);
  const scene = script.scenes[i];
  const local = t - timeline.starts[i];
  const p = local / scene.duration;

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // --- photo layer, with transition from previous scene
  const tr = scene.transitionIn;
  const q = clamp01(local / TRANSITION_SEC);
  const prev = i > 0 ? script.scenes[i - 1] : null;
  const prevP = prev ? (t - timeline.starts[i - 1]) / prev.duration : 0;

  if (prev && q < 1 && tr === "crossfade") {
    drawPhoto(ctx, image, cameraFor(prev, prevP, t));
    ctx.globalAlpha = easeInOutSine(q);
    drawPhoto(ctx, image, cameraFor(scene, p, t));
    ctx.globalAlpha = 1;
  } else if (prev && q < 1 && tr === "zoom-through") {
    const z = easeOutExpo(q);
    const camPrev = cameraFor(prev, prevP, t);
    camPrev.scale *= 1 + 0.35 * z;
    drawPhoto(ctx, image, camPrev);
    ctx.globalAlpha = z;
    const cam = cameraFor(scene, p, t);
    cam.scale *= 1 + 0.12 * (1 - z);
    drawPhoto(ctx, image, cam);
    ctx.globalAlpha = 1;
  } else {
    drawPhoto(ctx, image, cameraFor(scene, p, t));
  }

  // Vignette for depth
  const vg = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.48, HEIGHT * 0.3, WIDTH / 2, HEIGHT * 0.5, HEIGHT * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (prev && tr === "flash" && local < 0.22) {
    ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - easeOutCubic(local / 0.22))})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // --- text layer
  const isLast = i === script.scenes.length - 1;
  const exitP = isLast ? 0 : clamp01((local - (scene.duration - EXIT_SEC)) / EXIT_SEC);
  drawText(ctx, input, scene, local, exitP);

  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, input: RenderInput, scene: Scene, local: number, exitP: number) {
  const { script, analysis } = input;
  const leg = analysis[scene.text.position].legibility;
  const marginX = 90;
  const maxW = WIDTH - marginX * 2;
  const isCta = scene.text.role === "cta";
  const L = layoutText(ctx, script, scene, isCta ? maxW - 120 : maxW);

  const bandCenter = { top: 0.24, center: 0.5, bottom: 0.76 }[scene.text.position] * HEIGHT;
  const top = bandCenter - L.blockH / 2;
  const left = isCta ? (WIDTH - L.blockW) / 2 : marginX;

  // Scrim: a soft band, sized to the block, faded with the text.
  const textIn = clamp01(local / 0.25);
  const scrimA = leg.scrimAlpha * textIn * (1 - exitP);
  if (scrimA > 0.01 && !isCta) {
    const pad = 220;
    const g = ctx.createLinearGradient(0, top - pad, 0, top + L.blockH + pad);
    g.addColorStop(0, `rgba(${leg.scrimColor},0)`);
    g.addColorStop(0.32, `rgba(${leg.scrimColor},${scrimA})`);
    g.addColorStop(0.68, `rgba(${leg.scrimColor},${scrimA})`);
    g.addColorStop(1, `rgba(${leg.scrimColor},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, top - pad, WIDTH, L.blockH + pad * 2);
  }

  ctx.save();
  ctx.font = fontString(script, L.size);
  setTracking(ctx, script, L.size);
  ctx.textBaseline = "alphabetic";
  const ascent = L.size * 0.8;

  // Exit: lift and fade
  if (exitP > 0) {
    ctx.globalAlpha = 1 - easeOutCubic(exitP);
    ctx.translate(0, -40 * easeOutCubic(exitP));
  }

  const brand = script.brand.color;
  const bgUnder = leg.text === "light" ? 0.06 : 0.9; // approx luminance under text after scrim
  const brandReadable = contrast(hexLum(brand), bgUnder) >= 3;

  if (isCta) {
    drawCta(ctx, script, L, left, top, ascent, local);
    ctx.restore();
    return;
  }

  if (leg.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 4;
  }

  const anim = scene.text.animation;
  const totalChars = L.words.reduce((a, w) => Math.max(a, w.charStart + w.text.length), 0);

  const paintWord = (w: Word, alpha: number, dy: number, scale = 1, clipChars?: number) => {
    if (alpha <= 0.001) return;
    const x = left + w.x;
    const y = top + L.lines[w.line].y + ascent;
    const txt = clipChars !== undefined ? w.text.slice(0, clipChars) : w.text;
    if (!txt) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (scale !== 1) {
      const cx = left + L.blockW / 2,
        cy = top + L.blockH / 2;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
    const color = w.emph && brandReadable ? brand : leg.textColor;
    ctx.fillStyle = color;
    ctx.fillText(txt, x, y + dy);
    if (w.emph && !brandReadable) {
      // Brand color fails contrast as text: use it as an underline bar instead.
      ctx.shadowColor = "transparent";
      ctx.fillStyle = brand;
      const wTxt = clipChars !== undefined ? ctx.measureText(txt).width : w.w;
      ctx.fillRect(x, y + dy + L.size * 0.12, wTxt, Math.max(8, L.size * 0.09));
    }
    ctx.restore();
  };

  switch (anim) {
    case "word-by-word": {
      const stagger = Math.min(0.12, 0.9 / Math.max(1, L.words.length));
      L.words.forEach((w, k) => {
        const lp = clamp01((local - 0.05 - k * stagger) / 0.28);
        paintWord(w, easeOutCubic(lp), (1 - easeOutCubic(lp)) * 36);
      });
      break;
    }
    case "punch-in": {
      const lp = clamp01(local / 0.32);
      const s = 1 + 0.38 * (1 - easeOutBack(lp));
      L.words.forEach((w) => paintWord(w, clamp01(lp * 2.5), 0, s));
      break;
    }
    case "typewriter": {
      const cps = Math.max(22, totalChars / 0.9);
      const shown = Math.floor(Math.max(0, local - 0.05) * cps);
      L.words.forEach((w) => {
        const c = shown - w.charStart;
        if (c > 0) paintWord(w, 1, 0, 1, Math.min(w.text.length, c));
      });
      // caret
      const done = shown >= totalChars;
      const blink = done ? Math.floor(local * 2.4) % 2 === 0 : true;
      if (blink) {
        let cw: Word | undefined = L.words[0];
        let cx = left;
        for (const w of L.words) {
          const c = shown - w.charStart;
          if (c <= 0) break;
          cw = w;
          cx = left + w.x + ctx.measureText(w.text.slice(0, Math.min(w.text.length, c))).width + 6;
        }
        if (cw) {
          ctx.save();
          ctx.shadowColor = "transparent";
          ctx.fillStyle = brandReadable ? brand : leg.textColor;
          const y = top + L.lines[cw.line].y;
          ctx.fillRect(cx, y + L.size * 0.12, Math.max(10, L.size * 0.09), L.size * 0.82);
          ctx.restore();
        }
      }
      break;
    }
    case "rise": {
      L.lines.forEach((ln, li) => {
        const lp = easeOutCubic(clamp01((local - li * 0.09) / 0.42));
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top + ln.y - L.size * 0.1, WIDTH, L.lineH + L.size * 0.2);
        ctx.clip();
        L.words.filter((w) => w.line === li).forEach((w) => paintWord(w, 1, (1 - lp) * L.lineH * 1.1));
        ctx.restore();
      });
      break;
    }
    case "split-reveal": {
      L.lines.forEach((ln, li) => {
        const lp = clamp01((local - li * 0.08) / 0.45);
        const wipe = easeOutExpo(lp);
        const y = top + ln.y;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left - 10, y - L.size * 0.1, (ln.w + 20) * wipe, L.lineH + L.size * 0.2);
        ctx.clip();
        L.words.filter((w) => w.line === li).forEach((w) => paintWord(w, 1, 0));
        ctx.restore();
        // the brand bar that leads the wipe
        if (lp < 1) {
          ctx.save();
          ctx.shadowColor = "transparent";
          ctx.fillStyle = brand;
          const bx = left - 10 + (ln.w + 20) * wipe;
          const bw = Math.max(14, L.size * 0.14) * (1 - easeOutCubic(lp));
          ctx.fillRect(bx, y, bw, L.lineH);
          ctx.restore();
        }
      });
      break;
    }
  }
  ctx.restore();
}

function drawCta(ctx: CanvasRenderingContext2D, script: VideoScript, L: Layout, left: number, top: number, ascent: number, local: number) {
  const brand = script.brand.color;
  const onBrand = contrast(hexLum(brand), 1) >= contrast(hexLum(brand), 0.012) ? "#ffffff" : "#141414";
  const lp = easeOutBack(clamp01(local / 0.5));
  const padX = 64,
    padY = 44;
  const w = L.blockW + padX * 2;
  const h = L.blockH + padY * 2;
  const x = (WIDTH - w) / 2;
  const y = top - padY + (1 - lp) * 80;
  ctx.save();
  ctx.globalAlpha *= clamp01(local / 0.25);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = brand;
  const r = Math.min(h / 2, 70);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = onBrand;
  const dy = y - (top - padY);
  L.words.forEach((wd) => ctx.fillText(wd.text, left + wd.x, top + L.lines[wd.line].y + ascent + dy));
  // A small arrow that nudges after the pill lands: a silent "tap here" cue.
  const nudge = local > 0.6 ? Math.sin((local - 0.6) * 6) * 10 : 0;
  const ay = y + h + 70;
  ctx.globalAlpha *= clamp01((local - 0.4) / 0.3);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 26, ay + nudge);
  ctx.lineTo(WIDTH / 2, ay + 26 + nudge);
  ctx.lineTo(WIDTH / 2 + 26, ay + nudge);
  ctx.stroke();
  ctx.restore();
}
