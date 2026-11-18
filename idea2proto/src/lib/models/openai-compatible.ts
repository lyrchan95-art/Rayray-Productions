import { ProviderError, type CompletionRequest, type ModelProvider } from "./provider";

/** GLM (Zhipu) and DeepSeek both expose an OpenAI-compatible /chat/completions endpoint. */
export class OpenAICompatibleProvider implements ModelProvider {
  constructor(
    readonly id: string,
    private baseUrl: string,
    private apiKey: string,
  ) {}

  private body(req: CompletionRequest, stream: boolean) {
    return JSON.stringify({
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens,
      stream,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    });
  }

  private async post(req: CompletionRequest, stream: boolean) {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: this.body(req, stream),
      signal: req.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(`${this.id} ${res.status}: ${text.slice(0, 300)}`, res.status);
    }
    return res;
  }

  async complete(req: CompletionRequest): Promise<string> {
    const res = await this.post(req, false);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? "";
  }

  async *stream(req: CompletionRequest): AsyncIterable<string> {
    const res = await this.post(req, true);
    if (!res.body) throw new ProviderError(`${this.id}: empty stream`);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) yield delta as string;
        } catch {
          /* keep-alive or partial frame */
        }
      }
    }
  }
}
