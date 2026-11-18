/**
 * Zero-cost keyword classifier. Pure module (no server deps) so it can run in tests,
 * the eval script, the mock provider, and as the fallback when the cheap model is down.
 * Handles English, Traditional/Simplified Chinese, Cantonese colloquialisms and 中英夾雜.
 */
import type { SkillId, TurnSkill } from "../types";

export interface RouteContext {
  /** skill of the idea's current artifact, if any */
  artifactSkill?: SkillId | null;
}

export interface RouteResult {
  skill: TurnSkill;
  confidence: number;
  scores: Record<TurnSkill, number>;
}

export const CONFIDENCE_THRESHOLD = 0.55;

type Rule = [RegExp, number];

const GAME: Rule[] = [
  [/\b(game|games|gameplay|arcade|platformer|puzzle|runner|shooter|snake|tetris-like|flappy|clicker|quiz game)\b/i, 3],
  [/\b(score|high ?score|level|lives|enemy|enemies|boss|jump|dodge|tap to|swipe to|collect|obstacle)s?\b/i, 1.5],
  [/(遊戲|游戏|打機|玩法|關卡|关卡|分數|分数|得分|過關|过关|小遊戲|手遊|跳躍|閃避|射擊|拼圖|打怪|接住|彈|躲)/, 3],
  [/(玩|跳|射|撞|食|追)/, 0.8],
];

const VARIANTS: Rule[] = [
  [/\b(variants?|variations?|styles?|style options|design directions?|directions|moodboard|mood|look and feel|aesthetics?|palettes?|colou?r schemes?|themes|explorations?|alternatives)\b/i, 2.5],
  [/\b(three|3|five|5|several|different|multiple|a few)\s+(versions|looks|styles|designs|options|takes)\b/i, 3],
  [/(風格|风格|設計方向|设计方向|幾個版本|几个版本|唔同款|不同款|唔同style|多款|配色|色調|色调|視覺方向|視覺|感覺|款式|三個版本|3個版本|幾款)/, 3],
];

const HTML: Rule[] = [
  [/\b(landing page|web ?page|website|site|web app|app|form|tool|dashboard|calculator|tracker|booking|checkout|signup|sign-up|menu|portfolio|todo|to-do|timer|converter|planner|prototype|mockup|ui|screen|page)\b/i, 1.6],
  [/\b(build|make|create|generate|design|prototype|mock up|whip up|show me)\b/i, 1],
  [/(網頁|网页|網站|网站|頁面|页面|落地頁|工具|表格|計算機|计算器|記帳|记账|預約|预约|訂餐|订餐|清單|清单|原型|介面|界面|畫面|整個|整一個|做個|做一個|幫我整|帮我做|生成)/, 1.6],
];

const CAPTURE: Rule[] = [
  [/\b(i have an idea|idea:|an idea for|what if|brain ?dump|thinking about|concept|i want to start|startup idea|business idea|side project)\b/i, 2.5],
  [/(我有個idea|我有個主意|諗到|谂到|想到一個|點子|点子|構思|构思|諗緊|有個諗法|有个想法|創業|创业|想做個生意|呢個idea)/i, 2.5],
];

const TWEAK: Rule[] = [
  [/\b(bigger|smaller|larger|more|less|darker|lighter|brighter|playful|serious|minimal|bolder|faster|slower|change|make it|make the|add|remove|replace|swap|move|increase|decrease|fix|tweak|instead|colou?r|font|button|spacing|padding|background|title|text|in cantonese|in english|dark mode)\b/i, 1.4],
  [/(大啲|細啲|多啲|少啲|快啲|慢啲|再.{0,6}啲|改|加|刪|删|轉|转|換|换|移|顏色|颜色|字體|字体|掣|按鈕|按钮|背景|標題|标题|用廣東話|用广东话|英文|深色|淺色|好玩啲|簡潔啲|活潑啲)/, 1.4],
];

const CHAT: Rule[] = [
  [/\?\s*$|？\s*$/, 1.6],
  [/^(what|how|why|should|can you explain|is it|is there|do you|does|which|who|when|where)\b/i, 1.8],
  [/\b(explain|advice|recommend|compare|pros and cons|market|pricing|competitors?|thoughts on|opinion)\b/i, 1.4],
  [/(點解|点解|點樣|点样|係咪|是不是|有冇|有没有|咩|嗎|吗|呢\s*$|建議|建议|意見|意见|比較|比较|市場|市场|定價|定价|對手|对手|你覺得|你觉得)/, 1.6],
];

const score = (rules: Rule[], text: string) => rules.reduce((s, [re, w]) => (re.test(text) ? s + w : s), 0);

export function heuristicRoute(input: string, ctx: RouteContext = {}): RouteResult {
  const text = input.trim();
  const s: Record<TurnSkill, number> = {
    "game-prototype": score(GAME, text),
    "design-variants": score(VARIANTS, text),
    "prototype-html": score(HTML, text),
    "idea-capture": score(CAPTURE, text),
    chat: score(CHAT, text),
  };

  // A tweak with a live artifact is an iteration on that artifact's skill.
  const tweak = score(TWEAK, text);
  if (ctx.artifactSkill && ctx.artifactSkill !== "idea-capture" && tweak > 0) {
    s[ctx.artifactSkill] += tweak + 1;
  }

  // Games and variants are more specific than "page/app"; let them win ties.
  if (s["game-prototype"] >= 3) s["prototype-html"] *= 0.5;
  if (s["design-variants"] >= 2.5) s["prototype-html"] *= 0.6;

  // Long rambling input with no build verb reads as raw idea capture.
  if (text.length > 160 && s["prototype-html"] < 2 && s["game-prototype"] < 3 && s["design-variants"] < 2.5) {
    s["idea-capture"] += 1.5;
  }

  const entries = Object.entries(s) as [TurnSkill, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [top, topScore] = entries[0];
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (topScore === 0) return { skill: "chat", confidence: 0.3, scores: s };

  // Confidence blends dominance over the runner-up with absolute evidence strength.
  const dominance = topScore / total;
  const strength = Math.min(1, topScore / 3);
  const confidence = Math.round((0.6 * dominance + 0.4 * strength) * 100) / 100;

  if (confidence < CONFIDENCE_THRESHOLD) return { skill: "chat", confidence, scores: s };
  return { skill: top, confidence, scores: s };
}
