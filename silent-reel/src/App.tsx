import { useEffect, useMemo, useRef, useState } from "react";
import { Monitor } from "@/components/Monitor";
import { generateScript, getSample, templateScript, type AgentLog, type BriefForm, type FontPref } from "@/lib/agent";
import { exportVideo } from "@/lib/export";
import { analyzeImage, buildTimeline, FONT_FAMILIES, loadRenderFonts, type Band, type RenderInput } from "@/lib/renderer";
import { makeSamplePhoto } from "@/lib/samplePhoto";
import { SCHEMA_VERSION, VideoScriptSchema, formatIssues, type VideoScript } from "@/lib/schema";

type Photo = { el: HTMLImageElement | HTMLCanvasElement; name: string; sample: boolean; thumb: string };

const TONES = ["Calm", "Confident", "Playful", "Luxurious", "Warm", "Bold"];
const FONTS: FontPref[] = ["grotesk", "serif", "condensed", "mono"];

const SAMPLE_FORM: BriefForm = {
  goal: "Launch our new stoneware mug",
  tone: "Calm",
  audience: "Slow-morning coffee people",
  message: "Hand-thrown in small batches, glazed to feel like river stone",
  cta: "Shop the first batch",
  color: "#2f6b5a",
  font: "grotesk",
};

type DownloadsNS = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "reel"
  );
}

export default function App() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [form, setForm] = useState<BriefForm>(SAMPLE_FORM);
  const [script, setScript] = useState<VideoScript>(() => templateScript(SAMPLE_FORM));
  const [scriptText, setScriptText] = useState(() => JSON.stringify(templateScript(SAMPLE_FORM), null, 2));
  const [issues, setIssues] = useState<string[]>([]);
  const [briefAtScript, setBriefAtScript] = useState<string>(JSON.stringify(SAMPLE_FORM));
  const [fontsReady, setFontsReady] = useState(false);
  const [source, setSource] = useState<"sample" | "claude" | "claude-repaired" | "template" | "edited">("sample");
  const [log, setLog] = useState<AgentLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [claudeAvail, setClaudeAvail] = useState<boolean | null>(null);
  const agentCtl = useRef<AbortController | null>(null);

  const [exp, setExp] = useState<{ progress: number; running: boolean; error?: string }>({ progress: 0, running: false });
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string; ms: number } | null>(null);
  const exportCtl = useRef<AbortController | null>(null);
  const [downloads, setDownloads] = useState<DownloadsNS | null | undefined>(undefined);
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  // Boot: sample photo, fonts, capabilities.
  useEffect(() => {
    const c = makeSamplePhoto();
    setPhoto({ el: c, name: "sample-mug.jpg", sample: true, thumb: c.toDataURL("image/jpeg", 0.7) });
    loadRenderFonts().finally(() => setFontsReady(true));
    getSample().then((s) => setClaudeAvail(!!s));
    if (window.claude?.use) {
      (window.claude.use("downloads") as Promise<DownloadsNS | null>).then(setDownloads).catch(() => setDownloads(null));
    } else setDownloads(null);
  }, []);

  const analysis = useMemo(() => (photo ? analyzeImage(photo.el) : null), [photo]);
  const renderInput: RenderInput | null = useMemo(() => {
    if (!photo || !analysis) return null;
    return { script, timeline: buildTimeline(script), image: photo.el, analysis };
    // fontsReady forces a new object so the monitor repaints with real fonts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, analysis, script, fontsReady]);

  // Brand color and font are the user's: apply them to the script live.
  useEffect(() => {
    setScript((s) => {
      if (s.brand.color === form.color && s.brand.font === form.font) return s;
      const next = { ...s, brand: { color: form.color, font: form.font } };
      setScriptText(JSON.stringify(next, null, 2));
      return next;
    });
  }, [form.color, form.font]);

  const briefDirty = useMemo(() => {
    const a = JSON.parse(briefAtScript) as BriefForm;
    return a.goal !== form.goal || a.tone !== form.tone || a.audience !== form.audience || a.message !== form.message || a.cta !== form.cta;
  }, [briefAtScript, form]);

  const applyScript = (s: VideoScript, src: typeof source) => {
    setScript(s);
    setScriptText(JSON.stringify(s, null, 2));
    setIssues([]);
    setSource(src);
    setResult(null);
  };

  const onFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPhoto({ el: img, name: file.name, sample: false, thumb: url });
      setResult(null);
    };
    img.src = url;
  };

  const write = async () => {
    if (!photo) return;
    agentCtl.current?.abort();
    const ctl = new AbortController();
    agentCtl.current = ctl;
    setBusy(true);
    setLog([{ kind: "info", text: "Thinking…" }]);
    try {
      const r = await generateScript(form, photo.el, ctl.signal);
      applyScript(r.script, r.source);
      setLog(r.log);
      setBriefAtScript(JSON.stringify(form));
    } catch (e) {
      setLog([{ kind: "warn", text: (e as { code?: string }).code === "cancelled" ? "Stopped." : String((e as Error).message ?? e) }]);
    } finally {
      setBusy(false);
    }
  };

  const useTemplate = () => {
    applyScript(templateScript(form), "template");
    setBriefAtScript(JSON.stringify(form));
    setLog([{ kind: "info", text: "Built-in template wrote the script from your brief." }]);
  };

  const onEditJson = (txt: string) => {
    setScriptText(txt);
    let raw: unknown;
    try {
      raw = JSON.parse(txt);
    } catch (e) {
      setIssues([`JSON: ${(e as Error).message}`]);
      return;
    }
    const r = VideoScriptSchema.safeParse(raw);
    if (!r.success) {
      setIssues(formatIssues(r.error));
      return;
    }
    setIssues([]);
    setScript(r.data);
    setSource("edited");
    setResult(null);
    if (r.data.brand.color !== form.color || r.data.brand.font !== form.font) {
      setForm((f) => ({ ...f, color: r.data.brand.color, font: r.data.brand.font }));
    }
  };

  const render = async () => {
    if (!renderInput) return;
    exportCtl.current?.abort();
    const ctl = new AbortController();
    exportCtl.current = ctl;
    setExp({ progress: 0, running: true });
    setSaveMsg("");
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const r = await exportVideo(renderInput, (p) => setExp((x) => ({ ...x, progress: p })), ctl.signal);
      setResult({ url: URL.createObjectURL(r.blob), blob: r.blob, ext: r.ext, ms: r.ms });
      setExp({ progress: 1, running: false });
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      setExp({ progress: 0, running: false, error: aborted ? undefined : `Render failed: ${(e as Error).message}` });
    }
  };

  const save = async () => {
    if (!result || !downloads) return;
    setSaveMsg("");
    try {
      await downloads.save({ filename: `${slug(script.title)}.${result.ext}`, data: result.blob });
      setSaveMsg("Saved.");
    } catch (e) {
      const code = (e as { code?: string }).code;
      setSaveMsg(code === "cancelled" || code === "declined" ? "Save cancelled." : `Couldn't save (${code ?? "error"}).`);
    }
  };

  const set = <K extends keyof BriefForm>(k: K, v: BriefForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid = issues.length === 0;
  const totalFrames = renderInput?.timeline.totalFrames ?? 450;

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <h1>Silent Reel</h1>
        </div>
        <dl className="spec">
          <div>
            <dt>Format</dt>
            <dd>1080×1920</dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>30 fps</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>15.00 s</dd>
          </div>
          <div>
            <dt>Audio</dt>
            <dd>None</dd>
          </div>
        </dl>
      </header>

      <main className="bay">
        {/* ---------------- Brief ---------------- */}
        <section className="col brief" aria-labelledby="brief-h">
          <h2 id="brief-h" className="eyebrow">
            Brief
          </h2>

          <label
            className={`drop ${dragOver ? "over" : ""}`}
            htmlFor="photo-input"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFile(e.dataTransfer.files?.[0]);
            }}
          >
            {photo && <img src={photo.thumb} alt="" className="thumb" />}
            <span className="drop-copy">
              <strong>{photo?.sample ? "Sample photo" : photo?.name}</strong>
              <span>{photo?.sample ? "Drop your own photo here, or click to choose one." : "Click or drop to replace."}</span>
            </span>
            <input id="photo-input" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>

          <div className="field">
            <label htmlFor="f-goal">Goal</label>
            <input id="f-goal" value={form.goal} maxLength={80} onChange={(e) => set("goal", e.target.value)} />
          </div>

          <div className="field">
            <span className="label" id="tone-l">
              Tone
            </span>
            <div className="chips" role="radiogroup" aria-labelledby="tone-l">
              {TONES.map((t) => (
                <button
                  key={t}
                  id={`tone-${t}`}
                  role="radio"
                  aria-checked={form.tone === t}
                  className={`chip ${form.tone === t ? "on" : ""}`}
                  onClick={() => set("tone", t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-aud">Audience</label>
            <input id="f-aud" value={form.audience} maxLength={80} onChange={(e) => set("audience", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="f-msg">
              Key message <span className="count">{form.message.length}/140</span>
            </label>
            <textarea id="f-msg" rows={3} value={form.message} maxLength={140} onChange={(e) => set("message", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="f-cta">Call to action</label>
            <input id="f-cta" value={form.cta} maxLength={40} onChange={(e) => set("cta", e.target.value)} />
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="f-color">Brand color</label>
              <div className="color">
                <input id="f-color" type="color" value={form.color} onChange={(e) => set("color", e.target.value)} />
                <input
                  id="f-color-hex"
                  aria-label="Brand color hex"
                  value={form.color}
                  onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && set("color", e.target.value.toLowerCase())}
                />
              </div>
            </div>
          </div>

          <div className="field">
            <span className="label" id="font-l">
              Type
            </span>
            <div className="fonts" role="radiogroup" aria-labelledby="font-l">
              {FONTS.map((f) => (
                <button
                  key={f}
                  id={`font-${f}`}
                  role="radio"
                  aria-checked={form.font === f}
                  className={`font-opt ${form.font === f ? "on" : ""}`}
                  onClick={() => set("font", f)}
                >
                  <span
                    className="aa"
                    style={{ fontFamily: FONT_FAMILIES[f].family, fontWeight: FONT_FAMILIES[f].weight }}
                  >
                    {FONT_FAMILIES[f].upper ? "AA" : "Aa"}
                  </span>
                  <span className="fl">{FONT_FAMILIES[f].label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="actions">
            {busy ? (
              <button id="stop-btn" className="btn" onClick={() => agentCtl.current?.abort()}>
                Stop
              </button>
            ) : (
              <button id="write-btn" className="btn primary" onClick={write} disabled={!photo}>
                {claudeAvail === false ? "Write script" : "Write script with Claude"}
              </button>
            )}
            <button id="template-btn" className="btn ghost" onClick={useTemplate} disabled={busy}>
              Use template
            </button>
          </div>
          <p className="hint">
            {busy
              ? "Claude is reading your photo and brief. This usually takes 10–40 seconds."
              : briefDirty
                ? "The brief changed since this script was written. Write a new one to use it."
                : claudeAvail === false
                  ? "Claude isn't reachable in this view, so scripts come from the built-in template."
                  : "Color and type apply instantly. Other fields need a new script."}
          </p>
        </section>

        {/* ---------------- Monitor ---------------- */}
        <section className="col monitor-col" aria-label="Preview">
          <div className="monitor-head">
            <h2 className="eyebrow">Program</h2>
            <span className="title-slate" title={script.title}>
              {script.title}
            </span>
          </div>
          <Monitor input={renderInput} fontsReady={fontsReady} />

          <div className="export">
            {exp.running ? (
              <>
                <div className="progress" role="progressbar" aria-valuenow={Math.round(exp.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${exp.progress * 100}%` }} />
                </div>
                <div className="export-row">
                  <span className="tc">
                    Encoding frame {Math.round(exp.progress * totalFrames)}/{totalFrames}
                  </span>
                  <button id="cancel-export" className="btn ghost sm" onClick={() => exportCtl.current?.abort()}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button id="render-btn" className="btn primary wide" onClick={render} disabled={!renderInput || !valid}>
                Render MP4
              </button>
            )}
            {exp.error && <p className="err">{exp.error}</p>}
            {result && (
              <div className="result">
                <video src={result.url} controls muted loop playsInline className="result-video" />
                <div className="result-meta">
                  <span className="tc">
                    {result.ext.toUpperCase()} · {(result.blob.size / 1e6).toFixed(1)} MB · rendered in {(result.ms / 1000).toFixed(1)} s
                  </span>
                  {downloads ? (
                    <button id="save-btn" className="btn primary sm" onClick={save}>
                      Save {result.ext.toUpperCase()}
                    </button>
                  ) : (
                    <span className="hint">Saving isn't available in this view. Open the video's menu to save it.</span>
                  )}
                  {saveMsg && <span className="hint">{saveMsg}</span>}
                  {result.ext === "webm" && (
                    <span className="hint">This browser can't encode H.264, so the file is WebM. Chrome or Edge will produce MP4.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---------------- Script ---------------- */}
        <section className="col script-col" aria-labelledby="script-h">
          <h2 id="script-h" className="eyebrow">
            VideoScript
          </h2>

          <div className={`status ${valid ? "ok" : "bad"}`}>
            <span className="dot" aria-hidden="true" />
            <span>
              {valid ? `Valid · schema v${SCHEMA_VERSION}` : `${issues.length} problem${issues.length > 1 ? "s" : ""} · preview shows last valid script`}
            </span>
            <span className="src">{sourceLabel(source)}</span>
          </div>
          {!valid && (
            <ul className="issues">
              {issues.slice(0, 6).map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}

          {analysis && (
            <div className="legibility">
              <h3 className="sub">Legibility</h3>
              <table>
                <thead>
                  <tr>
                    <th>Band</th>
                    <th>Text</th>
                    <th>Scrim</th>
                    <th>Contrast</th>
                  </tr>
                </thead>
                <tbody>
                  {(["top", "center", "bottom"] as Band[]).map((b) => {
                    const l = analysis[b].legibility;
                    const used = script.scenes.some((s) => s.text.position === b);
                    return (
                      <tr key={b} className={used ? "" : "unused"}>
                        <td>{b}</td>
                        <td>
                          <span className={`sw ${l.text}`} aria-hidden="true" />
                          {l.text}
                        </td>
                        <td>{Math.round(l.scrimAlpha * 100)}%</td>
                        <td>{l.contrast.toFixed(1)}:1</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="hint">Measured from your photo. The script can't override these.</p>
            </div>
          )}

          {log.length > 0 && (
            <ul className="log" aria-live="polite">
              {log.map((l, i) => (
                <li key={i} className={l.kind}>
                  {l.text}
                </li>
              ))}
            </ul>
          )}

          <label htmlFor="json" className="sub">
            Script JSON <span className="count">editable</span>
          </label>
          <textarea id="json" className="json" spellCheck={false} value={scriptText} onChange={(e) => onEditJson(e.target.value)} />
        </section>
      </main>
    </div>
  );
}

function sourceLabel(s: string) {
  switch (s) {
    case "sample":
      return "sample";
    case "claude":
      return "by Claude";
    case "claude-repaired":
      return "by Claude, repaired";
    case "template":
      return "template";
    case "edited":
      return "hand-edited";
    default:
      return s;
  }
}
