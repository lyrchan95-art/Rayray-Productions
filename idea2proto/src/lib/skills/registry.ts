/**
 * Skill library. Each skill = versioned prompt + executor + eval set (evals/<id>.json).
 * Pure module: prompt construction only, no I/O, so prompts are unit-testable.
 */
import type { ChatMessage, ModelTask } from "../models/provider";
import type { ModelRole } from "../models/router";
import type { IdeaSpec, Register, SkillId, TurnSkill } from "../types";

export interface SkillContext {
  register: Register;
  spec?: IdeaSpec;
  /** current artifact html when iterating */
  currentHtml?: string | null;
  history: ChatMessage[];
  input: string;
}

export interface Skill {
  id: TurnSkill;
  version: string;
  label: { en: string; zh: string };
  role: ModelRole;
  task: ModelTask;
  /** produces an artifact (single-file HTML) */
  producesArtifact: boolean;
  evalSet?: string;
  build(ctx: SkillContext): ChatMessage[];
}

export const REGISTER_PROMPT: Record<Register, string> = {
  yue: `語言與文案準則（資深香港文案）：用香港廣東話口語（繁體中文），用地道香港詞彙同句末助詞（啦、喎、咩、啫、㗎、喇），節奏自然。唔好用書面語腔，亦唔好由英文直譯（翻譯腔）。常用英文詞（app、feature、promo、budget）自然夾雜，唔好過量。用字要準：喺、嘅、咗、唔、畀、嗰；唔好出現普通話詞彙（例如「視頻」「質量」「軟體」「網路」），要用「影片」「質素」「軟件」「網絡」。若內容屬銀行、法律、企業等正式場合，改用書面語繁體中文。標題先搵一個貼地痛點或明確好處做 hook；段落短、易 scan；CTA 清楚而且門檻低（例如「撳入嚟試下」）。Use Hong Kong Cantonese register.`,
  mixed: "Language: reply in natural Hong Kong 中英夾雜: Cantonese sentence structure, Traditional Chinese characters, English for product/tech terms, 繁體 HK vocabulary (影片, 質素, 軟件, 網絡), never Mandarin wording or translationese. Hook-first headlines, short scannable lines, one low-friction CTA.",
  en: "Language: reply in clear, friendly English. If the user writes Chinese, you may answer in Traditional Chinese.",
};

const specBlock = (spec?: IdeaSpec) => (spec ? `<spec>${JSON.stringify(spec)}</spec>` : "");

const ARTIFACT_RULES = `Output rules (strict):
- First, 1–2 short sentences to the user about what you built or changed. No headings, no lists.
- Then ONE fenced \`\`\`html block containing a COMPLETE single-file HTML document.
- Everything inline: CSS in <style>, JS in <script>. No external scripts, no fetch/XHR, no CDNs. Google Fonts <link> is allowed.
- Mobile-first: portrait phone (360–430px wide), <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">, 100dvh, env(safe-area-inset-*) padding, touch targets ≥ 44px, no hover-only interactions.
- localStorage is allowed for persistence (it is shimmed). No alert/confirm/prompt dialogs.
- Text inside the prototype follows the user's language (Traditional Chinese for Cantonese users). Write every visible line like a senior Hong Kong copywriter: hook-first headline, short lines, one clear low-friction call to action per screen, no translationese.
- Never truncate. Keep it under ~400 lines.`;

const iterationBlock = (html?: string | null) =>
  html
    ? `\n\nCURRENT PROTOTYPE (modify this — keep everything the user did not ask to change, and return the full updated document):\n\`\`\`html\n${html}\n\`\`\``
    : "";

export const SKILLS: Record<TurnSkill, Skill> = {
  "idea-capture": {
    id: "idea-capture",
    version: "1.2.0",
    label: { en: "Idea capture", zh: "記低點子" },
    role: "cheap",
    task: "structure",
    producesArtifact: false,
    evalSet: "evals/idea-capture.json",
    build: ({ register, input }) => [
      {
        role: "system",
        content: `You turn a founder's raw, possibly spoken, possibly Cantonese/中英夾雜 idea into a compact product spec.
Return ONLY a JSON object with keys:
  "title" (≤ 6 words, in the user's language),
  "oneLiner" (≤ 20 words),
  "coreInteraction" (the ONE thing a user does, ≤ 20 words),
  "targetUser" (≤ 12 words),
  "suggestedSkill": one of "prototype-html" | "game-prototype" | "design-variants".
Pick "game-prototype" for anything playable, "design-variants" when the user wants to explore looks/styles/branding, else "prototype-html".
Fix speech-to-text errors silently. Do not invent features the user did not imply.
${REGISTER_PROMPT[register]}`,
      },
      { role: "user", content: `<raw>${input}</raw>` },
    ],
  },

  "prototype-html": {
    id: "prototype-html",
    version: "1.3.0",
    label: { en: "Web prototype", zh: "網頁原型" },
    role: "code",
    task: "code",
    producesArtifact: true,
    evalSet: "evals/prototype-html.json",
    build: ({ register, spec, currentHtml, history, input }) => [
      {
        role: "system",
        content: `skill:prototype-html v1.3.0
You are a senior product designer-engineer. Build a working, clickable, mobile-first prototype of the idea as a single HTML file.
Make the core interaction actually work with realistic sample data. Polished, modern, generous spacing, clear hierarchy, one accent colour.
${ARTIFACT_RULES}
${REGISTER_PROMPT[register]}
${specBlock(spec)}`,
      },
      ...history,
      { role: "user", content: input + iterationBlock(currentHtml) },
    ],
  },

  "game-prototype": {
    id: "game-prototype",
    version: "1.2.0",
    label: { en: "Game prototype", zh: "小遊戲" },
    role: "code",
    task: "code",
    producesArtifact: true,
    evalSet: "evals/game-prototype.json",
    build: ({ register, spec, currentHtml, history, input }) => [
      {
        role: "system",
        content: `skill:game-prototype v1.2.0
You are a mobile game prototyper. Build a playable PORTRAIT game on a full-screen <canvas>.
- Touch controls via pointer events (tap / drag / swipe) — must work with one thumb; also support mouse.
- touch-action:none on the canvas; handle devicePixelRatio and resize; requestAnimationFrame loop.
- Start screen → play → game over with score and "tap to restart". Persist best score in localStorage.
- Difficulty ramps gently. Juicy feedback (screen shake, particles or flashes) but keep it lightweight.
${ARTIFACT_RULES}
${REGISTER_PROMPT[register]}
${specBlock(spec)}`,
      },
      ...history,
      { role: "user", content: input + iterationBlock(currentHtml) },
    ],
  },

  "design-variants": {
    id: "design-variants",
    version: "1.1.0",
    label: { en: "Design variants", zh: "設計方向" },
    role: "code",
    task: "code",
    producesArtifact: true,
    evalSet: "evals/design-variants.json",
    build: ({ register, spec, currentHtml, history, input }) => [
      {
        role: "system",
        content: `skill:design-variants v1.1.0
You are a brand and UI art director. Produce THREE to FIVE distinctly different visual directions for the SAME key screen of this idea,
in one HTML file as horizontally swipeable full-screen panels (CSS scroll-snap, one panel per 100vw).
Each panel: a small label "n/N · <direction name>", the same content rendered in that direction's palette, type pairing, radius, density and imagery style.
Directions must differ meaningfully (e.g. calm editorial vs. loud neon vs. soft rounded vs. brutalist) — not just colour swaps.
Add a subtle page indicator. No JS required beyond optional indicator updates.
${ARTIFACT_RULES}
${REGISTER_PROMPT[register]}
${specBlock(spec)}`,
      },
      ...history,
      { role: "user", content: input + iterationBlock(currentHtml) },
    ],
  },

  chat: {
    id: "chat",
    version: "1.1.0",
    label: { en: "Chat", zh: "傾偈" },
    role: "chat",
    task: "chat",
    producesArtifact: false,
    build: ({ register, spec, history, input }) => [
      {
        role: "system",
        content: `You are a sharp, warm product thinking partner for indie founders in Hong Kong.
Be concise and concrete. Prefer short paragraphs. Give opinions when asked. If the user seems to want something built, suggest they say so (e.g. "整個網頁" / "make it a game").
${REGISTER_PROMPT[register]}
${spec ? `The idea under discussion: ${specBlock(spec)}` : ""}`,
      },
      ...history,
      { role: "user", content: input },
    ],
  },
};

export const ARTIFACT_SKILLS: SkillId[] = ["prototype-html", "game-prototype", "design-variants"];
export const skillLabel = (s: TurnSkill, zh: boolean) => (zh ? SKILLS[s].label.zh : SKILLS[s].label.en);
