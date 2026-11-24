import { useEffect, useMemo, useRef, useState } from "react";
import { Monitor } from "@/components/Monitor";
import { LANGUAGE_LABEL, generateScript, getSample, templateScript, type AgentLog, type BriefForm, type FontPref } from "@/lib/agent";
import { exportVideo } from "@/lib/export";
import { analyzeImage, buildTimeline, fontSpec, loadScriptFonts, resolveStyle, type Band, type RenderInput } from "@/lib/renderer";
import { makeSamplePhoto } from "@/lib/samplePhoto";
import { LANGUAGES, SCHEMA_VERSION, TEXT_BACKGROUNDS, isCJK, type Language, VideoScriptSchema, formatIssues, type TextStyle, type VideoScript } from "@/lib/schema";

type Photo = { el: HTMLImageElement | HTMLCanvasElement; name: string; sample: boolean; thumb: string };

const TONES = ["Calm", "Confident", "Playful", "Luxurious", "Warm", "Bold"];
const FONTS: FontPref[] = ["grotesk", "serif", "condensed", "mono"];

const STYLE_DEFAULT: TextStyle = { textColor: "auto", background: "highlight", backgroundColor: "auto", backgroundOpacity: 0.85 };
const SAMPLE_BASE = { tone: "Calm", color: "#2f6b5a", font: "grotesk" as FontPref, text: STYLE_DEFAULT };

/** One sample brief per language, so switching language on an untouched form shows a real example. */
const SAMPLES: Record<Language, BriefForm> = {
  en: {
    ...SAMPLE_BASE,
    language: "en",
    goal: "Launch our new stoneware mug",
    audience: "Slow-morning coffee people",
    message: "Hand-thrown in small batches, glazed to feel like river stone",
    cta: "Shop the first batch",
  },
  "zh-Hant": {
    ...SAMPLE_BASE,
    language: "zh-Hant",
    goal: "新款石陶杯登場",
    audience: "喜愛慢活早晨的咖啡人",
    message: "小批量手工拉坯，釉色如河石般溫潤",
    cta: "立即預訂首批",
  },
  yue: {
    ...SAMPLE_BASE,
    language: "yue",
    goal: "全新石陶杯面世",
    audience: "鍾意慢活早晨嘅咖啡友",
    message: "小批量手工拉坯，釉色似河石咁溫潤",
    cta: "即刻預訂首批",
  },
  "zh-Hans": {
    ...SAMPLE_BASE,
    language: "zh-Hans",
    goal: "全新炻器杯上市",
    audience: "热爱慢生活早晨的咖啡人",
    message: "小批量手工拉坯，釉色温润如河石",
    cta: "立即预订首批",
  },
};
const SAMPLE_FORM = SAMPLES.en;
const LANGUAGE_NOTE: Record<Language, string> = {
  en: "English",
  "zh-Hant": "Written Chinese, Traditional characters",
  yue: "Spoken-style Hong Kong Cantonese, Traditional characters",
  "zh-Hans": "Mainland Chinese, Simplified characters",
};
const SAMPLE_KEYS = ["goal", "audience", "message", "cta"] as const;

const BG_LABEL: Record<TextStyle["background"], string> = {
  auto: "Auto",
  none: "None",
  band: "Band",
  box: "Box",
  highlight: "Highlight",
};
const BG_HELP: Record<TextStyle["background"], string> = {
  auto: "A soft band, as strong as the photo needs.",
  none: "Text only, with a shadow.",
  band: "A soft full-width band behind the text.",
  box: "One solid card behind the whole line.",
  highlight: "A marker-style strip behind each line.",
};
const READABLE = 4.5;

function ColorChoice({
  id,
  label,
  value,
  brand,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  brand: string;
  onChange: (v: string) => void;
}) {
  const presets: { key: string; label: string; hex: string | "auto" }[] = [
    { key: "auto", label: "Auto", hex: "auto" },
    { key: "white", label: "White", hex: "#ffffff" },
    { key: "black", label: "Black", hex: "#141414" },
    { key: "brand", label: "Brand", hex: brand },
  ];
  const isPreset = presets.some((p) => p.hex === value);
  return (
    <div className="field">
      <span className="label" id={`${id}-l`}>
        {label}
      </span>
      <div className="swatches" role="radiogroup" aria-labelledby={`${id}-l`}>
        {presets.map((p) => (
          <button
            key={p.key}
            id={`${id}-${p.key}`}
            role="radio"
            aria-checked={value === p.hex}
            className={`swatch-btn ${value === p.hex ? "on" : ""}`}
            onClick={() => onChange(p.hex)}
          >
            <span className={`swatch ${p.hex === "auto" ? "auto" : ""}`} style={p.hex === "auto" ? undefined : { background: p.hex }} aria-hidden="true" />
            {p.label}
          </button>
        ))}
        <label className={`swatch-btn ${!isPreset ? "on" : ""}`} htmlFor={`${id}-custom`}>
          <input
            id={`${id}-custom`}
            type="color"
            value={value === "auto" ? "#ffffff" : value}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
          />
          Custom
        </label>
      </div>
    </div>
  );
}

type DownloadsNS = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
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
  const [fontTick, setFontTick] = useState(0);
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
    getSample().then((s) => setClaudeAvail(!!s));
    if (window.claude?.use) {
      (window.claude.use("downloads") as Promise<DownloadsNS | null>).then(setDownloads).catch(() => setDownloads(null));
    } else setDownloads(null);
  }, []);

  const analysis = useMemo(() => (photo ? analyzeImage(photo.el) : null), [photo]);
  const renderInput: RenderInput | null = useMemo(() => {
    if (!photo || !analysis) return null;
    return { script, timeline: buildTimeline(script), image: photo.el, analysis };
    // fontTick forces a new object so the monitor repaints once the right fonts are in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, analysis, script, fontTick]);

  // Load the faces this script needs (Chinese fonts arrive in slices keyed by the characters used).
  const fontKey = `${script.language}|${script.brand.font}|${script.title}|${script.scenes.map((sc) => sc.text.content).join("")}`;
  useEffect(() => {
    let live = true;
    loadScriptFonts(script).finally(() => live && setFontTick((t) => t + 1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  // Brand color, font and language are the user's: apply them to the script live.
  useEffect(() => {
    setScript((s) => {
      if (s.language === form.language && s.brand.color === form.color && s.brand.font === form.font && JSON.stringify(s.brand.text) === JSON.stringify(form.text)) return s;
      const next = { ...s, language: form.language, brand: { color: form.color, font: form.font, text: form.text } };
      setScriptText(JSON.stringify(next, null, 2));
      return next;
    });
  }, [form.color, form.font, form.text, form.language]);

  const briefDirty = useMemo(() => {
    const a = JSON.parse(briefAtScript) as BriefForm;
    return (a.language ?? "en") !== form.language || a.goal !== form.goal || a.tone !== form.tone || a.audience !== form.audience || a.message !== form.message || a.cta !== form.cta;
  }, [briefAtScript, form]);

  const applyScript = (s: VideoScript, src: typeof source) => {
    setScript(s);
    setScriptText(JSON.stringify(s, null, 2));
    setIssues([]);
    setSource(src);
    setResult(null);
  };

  const setLanguage = (lang: Language) => {
    if (lang === form.language) return;
    const prev = SAMPLES[form.language];
    const untouched = SAMPLE_KEYS.every((k) => form[k] === prev[k]);
    if (untouched) {
      // The brief is still the sample, so swap in the sample for the new language and rebuild the preview.
      const next: BriefForm = { ...form, language: lang, ...Object.fromEntries(SAMPLE_KEYS.map((k) => [k, SAMPLES[lang][k]])) };
      setForm(next);
      applyScript(templateScript(next), "sample");
      setBriefAtScript(JSON.stringify(next));
      setLog([]);
    } else {
      setForm({ ...form, language: lang });
    }
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
    if (r.data.brand.color !== form.color || r.data.brand.font !== form.font || JSON.stringify(r.data.brand.text) !== JSON.stringify(form.text)) {
      setForm((f) => ({ ...f, color: r.data.brand.color, font: r.data.brand.font, text: r.data.brand.text }));
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
      await loadScriptFonts(renderInput.script);
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
  const setText = (patch: Partial<TextStyle>) => setForm((f) => ({ ...f, text: { ...f.text, ...patch } }));

  // Per-band readability with the current style, for bands the script actually uses.
  const bandStyles = analysis
    ? (["top", "center", "bottom"] as Band[]).map((b) => ({
        band: b,
        used: script.scenes.some((s) => s.text.position === b && s.text.role !== "cta"),
        rs: resolveStyle(script, analysis[b]),
      }))
    : [];
  const weak = bandStyles.filter((b) => b.used && b.rs.contrast < READABLE);
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
            <span className="label" id="lang-l">
              Reel language
            </span>
            <div className="langs" role="radiogroup" aria-labelledby="lang-l">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  id={`lang-${l}`}
                  role="radio"
                  aria-checked={form.language === l}
                  className={`lang-btn ${form.language === l ? "on" : ""}`}
                  lang={l === "en" ? "en" : l === "yue" ? "yue-Hant-HK" : l}
                  onClick={() => setLanguage(l)}
                >
                  {LANGUAGE_LABEL[l]}
                </button>
              ))}
            </div>
            <span className="hint">
              {LANGUAGE_NOTE[form.language]}.{form.language !== "en" ? " Your brief can be in any language; Claude adapts it." : ""}
            </span>
          </div>

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
                    style={{ fontFamily: fontSpec(f, form.language).family, fontWeight: fontSpec(f, form.language).weight }}
                  >
                    {isCJK(form.language) ? "字Aa" : fontSpec(f, form.language).upper ? "AA" : "Aa"}
                  </span>
                  <span className="fl">{fontSpec(f, form.language).label}</span>
                </button>
              ))}
            </div>
          </div>

          <fieldset className="textstyle">
            <legend className="eyebrow">Text style</legend>
            <ColorChoice id="tc" label="Text color" value={form.text.textColor} brand={form.color} onChange={(v) => setText({ textColor: v })} />

            <div className="field">
              <span className="label" id="bg-l">
                Background
              </span>
              <div className="seg" role="radiogroup" aria-labelledby="bg-l">
                {TEXT_BACKGROUNDS.map((b) => (
                  <button
                    key={b}
                    id={`bg-${b}`}
                    role="radio"
                    aria-checked={form.text.background === b}
                    className={`seg-btn ${form.text.background === b ? "on" : ""}`}
                    onClick={() => setText({ background: b })}
                  >
                    <span className={`bgicon bg-${b}`} aria-hidden="true">
                      <i />
                    </span>
                    {BG_LABEL[b]}
                  </button>
                ))}
              </div>
              <span className="hint">{BG_HELP[form.text.background]}</span>
            </div>

            {form.text.background !== "none" && (
              <ColorChoice
                id="bc"
                label="Background color"
                value={form.text.backgroundColor}
                brand={form.color}
                onChange={(v) => setText({ backgroundColor: v })}
              />
            )}

            {form.text.background !== "none" && form.text.background !== "auto" && (
              <div className="field">
                <label htmlFor="bg-op">
                  Background opacity <span className="count">{Math.round(form.text.backgroundOpacity * 100)}%</span>
                </label>
                <input
                  id="bg-op"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(form.text.backgroundOpacity * 100)}
                  onChange={(e) => setText({ backgroundOpacity: Number(e.target.value) / 100 })}
                />
              </div>
            )}

            {weak.length > 0 ? (
              <p className="warnline" role="status">
                Hard to read in the {weak.map((w) => `${w.band} (${w.rs.contrast.toFixed(1)}:1)`).join(" and ")} band
                {weak.length > 1 ? "s" : ""}. Aim for 4.5:1: add a background, raise its opacity, or set colors to Auto.
              </p>
            ) : (
              <p className="okline" role="status">
                Readable everywhere text appears (lowest {bandStyles.filter((b) => b.used).reduce((m, b) => Math.min(m, b.rs.contrast), 99).toFixed(1)}:1).
              </p>
            )}
          </fieldset>

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
          <Monitor input={renderInput} fontsReady={fontTick} />

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
                    <th>Behind</th>
                    <th>Contrast</th>
                  </tr>
                </thead>
                <tbody>
                  {bandStyles.map(({ band, used, rs }) => (
                    <tr key={band} className={used ? "" : "unused"}>
                      <td>{band}</td>
                      <td>
                        <span className="sw" style={{ background: rs.textColor }} aria-hidden="true" />
                        {rs.textColor}
                      </td>
                      <td>
                        {rs.bg === "none" ? "shadow" : `${rs.bg} ${Math.round(rs.bgAlpha * 100)}%`}
                        {rs.auto ? " (auto)" : ""}
                      </td>
                      <td className={rs.contrast < READABLE ? "low" : ""}>
                        {rs.contrast.toFixed(1)}:1{rs.contrast < READABLE ? " low" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">Worst case, measured from your photo with your text style. The script can't override this.</p>
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
