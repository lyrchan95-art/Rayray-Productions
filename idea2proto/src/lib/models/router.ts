import "server-only";
import { MockProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { ModelProvider } from "./provider";

/**
 * Roles, not vendors. Skills ask for a role; this table decides who serves it.
 *  - cheap  : classification + idea structuring (GLM flash)
 *  - chat   : general chat, Chinese & Cantonese register (GLM)
 *  - code   : HTML / game / variant generation (DeepSeek)
 *  - vision : photo → spec (GLM vision)
 * Swap a vendor by editing this file only.
 */
export type ModelRole = "cheap" | "chat" | "code" | "vision";

export interface ResolvedModel {
  provider: ModelProvider;
  model: string;
}

const env = (k: string, d = "") => process.env[k] || d;
const mock = new MockProvider();

function glm(): ModelProvider | null {
  const key = env("GLM_API_KEY");
  return key ? new OpenAICompatibleProvider("glm", env("GLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4"), key) : null;
}
function deepseek(): ModelProvider | null {
  const key = env("DEEPSEEK_API_KEY");
  return key ? new OpenAICompatibleProvider("deepseek", env("DEEPSEEK_BASE_URL", "https://api.deepseek.com"), key) : null;
}

/**
 * OpenRouter: one key reaches both GLM and DeepSeek. Used for whichever vendor has no direct key.
 * Model slugs are env-overridable; check them against openrouter.ai/models before launch.
 */
function openrouter(): ModelProvider | null {
  const key = env("OPENROUTER_API_KEY");
  return key ? new OpenAICompatibleProvider("openrouter", env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"), key, {
    "HTTP-Referer": env("PUBLIC_BASE_URL", "http://localhost:3000"),
    "X-Title": "Idea2Proto",
  }) : null;
}

export function resolve(role: ModelRole): ResolvedModel {
  const or = openrouter();
  const orModel = (k: string, d: string) => env(`OPENROUTER_${k}_MODEL`, d);
  const direct = { g: glm(), d: deepseek() };
  const routed = resolveDirect(role, direct.g, direct.d);
  if (!isMock(routed) || !or) return routed;
  switch (role) {
    case "cheap": return { provider: or, model: orModel("CHEAP", "z-ai/glm-4.5-air") };
    case "chat": return { provider: or, model: orModel("CHAT", "z-ai/glm-4.6") };
    case "vision": return { provider: or, model: orModel("VISION", "z-ai/glm-4.5v") };
    case "code": return { provider: or, model: orModel("CODE", "deepseek/deepseek-chat-v3.1") };
  }
}

function resolveDirect(role: ModelRole, g: ModelProvider | null, d: ModelProvider | null): ResolvedModel {
  switch (role) {
    case "cheap":
      return g ? { provider: g, model: env("GLM_CHEAP_MODEL", "glm-4-flash") } : { provider: mock, model: "mock" };
    case "chat":
      return g ? { provider: g, model: env("GLM_CHAT_MODEL", "glm-4.6") } : { provider: mock, model: "mock" };
    case "vision":
      return g ? { provider: g, model: env("GLM_VISION_MODEL", "glm-4v-flash") } : { provider: mock, model: "mock" };
    case "code":
      // DeepSeek first; GLM can generate HTML too if only GLM is configured.
      if (d) return { provider: d, model: env("DEEPSEEK_CODE_MODEL", "deepseek-chat") };
      if (g) return { provider: g, model: env("GLM_CHAT_MODEL", "glm-4.6") };
      return { provider: mock, model: "mock" };
  }
}

export const isMock = (r: ResolvedModel) => r.provider.id === "mock";
