import "server-only";

/**
 * Server-side speech-to-text. Any OpenAI-compatible /audio/transcriptions endpoint works
 * (GLM-ASR by default; Whisper-family or a self-hosted Cantonese model behind the same shape).
 */
export async function transcribe(audio: Blob, filename: string, language?: string): Promise<{ text: string; mock: boolean }> {
  const key = process.env.STT_API_KEY || process.env.GLM_API_KEY;
  if (!key) {
    return { text: "我有個 idea：整個幫打工仔揀午餐嘅小工具，撳一下就話你今日食咩", mock: true };
  }
  const base = (process.env.STT_BASE_URL || "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", process.env.STT_MODEL || "glm-asr");
  const lang = language || process.env.STT_LANGUAGE;
  if (lang) form.append("language", lang);
  const res = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`STT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { text?: string };
  return { text: (json.text ?? "").trim(), mock: false };
}
