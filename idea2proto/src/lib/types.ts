export type SkillId = "idea-capture" | "prototype-html" | "game-prototype" | "design-variants";
export type TurnSkill = SkillId | "chat";
export type Register = "yue" | "en" | "mixed";
export type InputMode = "voice" | "photo" | "text";

export interface IdeaSpec {
  title: string;
  oneLiner: string;
  coreInteraction: string;
  targetUser: string;
  suggestedSkill: Exclude<SkillId, "idea-capture">;
}

export interface Idea {
  id: string;
  title: string;
  oneLiner: string;
  spec: IdeaSpec;
  skill: SkillId;
  rawInput: string;
  inputMode: InputMode;
  currentVersion: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  skill: TurnSkill | null;
  versionN: number | null;
  feedback: -1 | 0 | 1 | null;
  createdAt: number;
}

export interface Version {
  n: number;
  html: string;
  skill: SkillId;
  note: string;
  createdAt: number;
}

export interface Publication {
  slug: string;
  versionN: number;
  url: string;
  createdAt: number;
  revokedAt: number | null;
}

/** Events streamed (NDJSON) from POST /api/ideas/:id/turn */
export type TurnEvent =
  | { type: "route"; skill: TurnSkill; confidence: number; provider: string; model: string }
  | { type: "user"; message: Message }
  | { type: "delta"; text: string }
  | { type: "progress"; chars: number }
  | { type: "artifact"; version: Version }
  | { type: "done"; message: Message }
  | { type: "error"; error: string; code?: string };
