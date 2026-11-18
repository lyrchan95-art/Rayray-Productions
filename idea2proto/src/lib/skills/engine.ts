import "server-only";
import { z } from "zod";
import { extractArtifact } from "../artifact/extract";
import type { ChatMessage } from "../models/provider";
import { isMock, resolve } from "../models/router";
import { addMessage, addVersion, getVersion, listMessages } from "../repo";
import type { Idea, IdeaSpec, Message, Register, SkillId, TurnEvent, TurnSkill } from "../types";
import { CONFIDENCE_THRESHOLD, heuristicRoute, type RouteResult } from "./heuristics";
import { ARTIFACT_SKILLS, SKILLS } from "./registry";

/* ───────────── classification ───────────── */

const ClassifySchema = z.object({
  skill: z.enum(["idea-capture", "prototype-html", "game-prototype", "design-variants", "chat"]),
  confidence: z.number().min(0).max(1),
});

export async function classify(input: string, artifactSkill: SkillId | null): Promise<RouteResult> {
  const heur = heuristicRoute(input, { artifactSkill });
  const cheap = resolve("cheap");
  if (isMock(cheap)) return heur;
  // Strong keyword evidence: skip the network round-trip.
  if (heur.confidence >= 0.85) return heur;
  try {
    const raw = await cheap.provider.complete({
      model: cheap.model,
      task: "classify",
      json: true,
      temperature: 0,
      maxTokens: 60,
      signal: AbortSignal.timeout(4000),
      messages: [
        {
          role: "system",
          content: `Route the user's message to ONE skill. Return JSON {"skill":..., "confidence":0..1}.
- "prototype-html": wants a web page/app/tool/form built or changed
- "game-prototype": wants a playable game built or changed
- "design-variants": wants several visual styles / design directions
- "idea-capture": dumping a new raw idea to be structured, no build request yet
- "chat": questions, advice, discussion
${artifactSkill ? `The user currently has a "${artifactSkill}" prototype open; tweak requests ("bigger buttons", "大啲", "more playful") belong to "${artifactSkill}".` : ""}
Messages may be Cantonese, Traditional Chinese, English or mixed.`,
        },
        { role: "user", content: input },
      ],
    });
    const parsed = ClassifySchema.parse(JSON.parse(raw));
    if (parsed.confidence < CONFIDENCE_THRESHOLD) return { ...heur, skill: "chat", confidence: parsed.confidence };
    return { ...heur, skill: parsed.skill, confidence: parsed.confidence };
  } catch {
    return heur;
  }
}

/* ───────────── structuring ───────────── */

export const SpecSchema = z.object({
  title: z.string().min(1).max(80),
  oneLiner: z.string().max(240).default(""),
  coreInteraction: z.string().max(240).default(""),
  targetUser: z.string().max(160).default(""),
  suggestedSkill: z.enum(["prototype-html", "game-prototype", "design-variants"]).catch("prototype-html"),
});

function parseJsonLoose(s: string) {
  const m = s.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : s);
}

export async function structureIdea(raw: string, register: Register): Promise<IdeaSpec> {
  const m = resolve("cheap");
  const out = await m.provider.complete({
    model: m.model,
    task: "structure",
    json: true,
    temperature: 0.3,
    maxTokens: 400,
    messages: SKILLS["idea-capture"].build({ register, input: raw, history: [] }),
  });
  return SpecSchema.parse(parseJsonLoose(out));
}

export async function structureFromPhoto(dataUrl: string, note: string, register: Register): Promise<IdeaSpec> {
  const m = resolve("vision");
  const sys = SKILLS["idea-capture"].build({ register, input: "", history: [] })[0];
  const out = await m.provider.complete({
    model: m.model,
    task: "vision",
    temperature: 0.3,
    maxTokens: 500,
    messages: [
      sys,
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: `<raw>Photo of an idea (sketch, whiteboard, napkin, screenshot or real-world scene). ${note}</raw> Read any handwriting. Return the JSON spec.` },
        ],
      },
    ],
  });
  return SpecSchema.parse(parseJsonLoose(out));
}

/* ───────────── context windowing ───────────── */

/**
 * GLM/DeepSeek degrade well before their nominal limits, so we keep history small:
 * newest turns first until a char budget (~12k tokens) is hit. Artifact HTML is never kept
 * in history — only the current version is attached, once, on iteration turns.
 */
const HISTORY_CHAR_BUDGET = 24_000;
const MAX_TURNS = 16;

export function windowHistory(messages: Message[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0 && out.length < MAX_TURNS; i--) {
    const m = messages[i];
    const content = m.versionN ? `${m.content}\n[produced prototype v${m.versionN}]` : m.content;
    if (used + content.length > HISTORY_CHAR_BUDGET) break;
    used += content.length;
    out.unshift({ role: m.role, content });
  }
  // Providers expect user-first alternation.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

/* ───────────── turns ───────────── */

export interface TurnInput {
  idea: Idea;
  register: Register;
  input: string;
  /** force a skill (e.g. first generation from the confirmed spec) */
  forceSkill?: TurnSkill;
  signal?: AbortSignal;
}

export async function* runTurn({ idea, register, input, forceSkill, signal }: TurnInput): AsyncGenerator<TurnEvent> {
  const history = windowHistory(listMessages(idea.id));
  const current = idea.currentVersion ? getVersion(idea.id, idea.currentVersion) : null;

  let route: RouteResult | { skill: TurnSkill; confidence: number };
  if (forceSkill) route = { skill: forceSkill, confidence: 1 };
  else route = await classify(input, current?.skill ?? null);

  // idea-capture mid-conversation means "here's more about the idea" — treat as chat.
  let skillId: TurnSkill = route.skill === "idea-capture" ? "chat" : route.skill;
  const skill = SKILLS[skillId];
  const model = resolve(skill.role);
  yield { type: "route", skill: skillId, confidence: route.confidence, provider: model.provider.id, model: model.model };

  const userMsg = addMessage(idea.id, { role: "user", content: input, skill: skillId });
  yield { type: "user", message: userMsg };

  const iterating = skill.producesArtifact && current && current.skill === skillId;
  const messages = skill.build({
    register,
    spec: idea.spec,
    currentHtml: iterating ? current!.html : null,
    history,
    input,
  });

  let full = "";
  let fenceAt = -1;
  let lastProgress = 0;
  try {
    for await (const chunk of model.provider.stream({
      model: model.model,
      task: skill.task,
      messages,
      temperature: skill.producesArtifact ? 0.6 : 0.7,
      maxTokens: skill.producesArtifact ? 8192 : 1500,
      signal,
    })) {
      full += chunk;
      if (!skill.producesArtifact) {
        yield { type: "delta", text: chunk };
        continue;
      }
      // Stream the prose note; summarise the code block as progress.
      if (fenceAt < 0) {
        const f = full.search(/```|<!doctype|<html/i);
        if (f >= 0) {
          fenceAt = f;
          const before = full.length - chunk.length;
          if (f > before) yield { type: "delta", text: full.slice(before, f) };
        } else {
          yield { type: "delta", text: chunk };
        }
      } else if (full.length - lastProgress > 400) {
        lastProgress = full.length;
        yield { type: "progress", chars: full.length - fenceAt };
      }
    }
  } catch (e) {
    if (signal?.aborted) return;
    yield { type: "error", error: (e as Error).message, code: "provider" };
    return;
  }

  let versionN: number | null = null;
  let content = full.trim();
  if (skill.producesArtifact) {
    const { note, html } = extractArtifact(full);
    if (html && ARTIFACT_SKILLS.includes(skillId as SkillId)) {
      const v = addVersion(idea.id, html, skillId as SkillId, note.slice(0, 500));
      versionN = v.n;
      content = note || "✓";
      yield { type: "artifact", version: v };
    } else {
      content = note || full.trim();
      skillId = "chat";
    }
  }

  const assistant = addMessage(idea.id, { role: "assistant", content, skill: skillId, versionN });
  yield { type: "done", message: assistant };
}
