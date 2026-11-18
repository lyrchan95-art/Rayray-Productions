export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

/** What the caller is asking for. Real providers ignore it; the mock provider uses it to pick a template. */
export type ModelTask = "classify" | "structure" | "chat" | "code" | "vision";

export interface CompletionRequest {
  model: string;
  task: ModelTask;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
}

/**
 * Every LLM vendor sits behind this interface. Skills never import a vendor directly —
 * they ask the router for a role ("chat", "code", ...) and get back a provider + model.
 */
export interface ModelProvider {
  readonly id: string;
  complete(req: CompletionRequest): Promise<string>;
  stream(req: CompletionRequest): AsyncIterable<string>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}
