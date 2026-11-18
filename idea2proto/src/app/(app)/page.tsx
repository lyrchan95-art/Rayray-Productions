"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { api, ApiError, fileToDataUrl } from "@/components/api";
import { useApp } from "@/components/AppShell";
import { Camera, Mic, Send, SkillIcon, Stop } from "@/components/icons";
import { useRecorder } from "@/components/useRecorder";
import { skillLabel } from "@/lib/skills/registry";
import type { Idea, IdeaSpec, InputMode } from "@/lib/types";

const BUILD_SKILLS = ["prototype-html", "game-prototype", "design-variants"] as const;

function SpecReview({ spec, setSpec, onGenerate, onReset, busy }: { spec: IdeaSpec; setSpec(s: IdeaSpec): void; onGenerate(): void; onReset(): void; busy: boolean }) {
  const { tr, lang } = useApp();
  const f = (k: keyof IdeaSpec) => ({
    value: spec[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setSpec({ ...spec, [k]: e.target.value }),
  });
  return (
    <section className="spec-card card" aria-labelledby="spec-h">
      <p className="muted" style={{ margin: "0 0 4px", fontSize: "var(--text-sm)" }}>{tr("reviewSpecSub")}</p>
      <h2 id="spec-h">{tr("reviewSpec")}</h2>
      <div className="field" style={{ marginTop: 16 }}>
        <label className="label" htmlFor="s-title">{tr("title")}</label>
        <input id="s-title" className="input" {...f("title")} />
      </div>
      <div className="field">
        <label className="label" htmlFor="s-one">{tr("oneLiner")}</label>
        <textarea id="s-one" className="textarea" rows={2} {...f("oneLiner")} />
      </div>
      <div className="field">
        <label className="label" htmlFor="s-core">{tr("coreInteraction")}</label>
        <textarea id="s-core" className="textarea" rows={2} {...f("coreInteraction")} />
      </div>
      <div className="field">
        <label className="label" htmlFor="s-user">{tr("targetUser")}</label>
        <input id="s-user" className="input" {...f("targetUser")} />
      </div>
      <div className="field">
        <span className="label" id="s-skill">{tr("buildAs")}</span>
        <div className="skill-picker" role="group" aria-labelledby="s-skill">
          {BUILD_SKILLS.map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={spec.suggestedSkill === s} onClick={() => setSpec({ ...spec, suggestedSkill: s })}>
              <SkillIcon skill={s} size={16} /> {skillLabel(s, lang === "zh")}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-lg btn-block" onClick={onGenerate} disabled={busy || !spec.title.trim()}>
        {tr("generate")}
      </button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onReset} disabled={busy}>{tr("startOver")}</button>
    </section>
  );
}

export default function CapturePage() {
  const { tr, toast, bumpUsage, refreshIdeas, ideas, demo } = useApp();
  const router = useRouter();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<InputMode>("text");
  const [spec, setSpec] = useState<IdeaSpec | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const fail = useCallback((e: unknown) => {
    const err = e as ApiError;
    toast(err.code === "limit" ? tr("limitReached") : err.message || "Error");
    setStatus("");
  }, [toast, tr]);

  const structure = useCallback(async (raw: string, m: InputMode) => {
    setStatus(tr("structuring"));
    setBusy(true);
    try {
      const { spec } = await api<{ spec: IdeaSpec }>("/api/capture/structure", { method: "POST", json: { text: raw } });
      bumpUsage();
      setSpec(spec);
      setMode(m);
      setStatus("");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [bumpUsage, fail, tr]);

  const onAudio = useCallback(async (blob: Blob) => {
    setStatus(tr("transcribing"));
    try {
      const form = new FormData();
      form.append("audio", blob, "speech");
      const { text: said } = await api<{ text: string }>("/api/capture/stt", { method: "POST", body: form });
      if (!said) { setStatus(""); return; }
      setText(said);
      await structure(said, "voice"); // fast path: speak → spec with no extra tap
    } catch (e) {
      fail(e);
    }
  }, [fail, structure, tr]);

  const rec = useRecorder(onAudio);

  const onPhoto = async (file: File) => {
    setStatus(tr("structuring"));
    setBusy(true);
    try {
      const image = await fileToDataUrl(file);
      const { spec } = await api<{ spec: IdeaSpec }>("/api/capture/photo", { method: "POST", json: { image, note: text } });
      bumpUsage();
      setSpec(spec);
      setMode("photo");
      setStatus("");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!spec) return;
    setBusy(true);
    try {
      const { idea } = await api<{ idea: Idea }>("/api/ideas", { method: "POST", json: { spec, rawInput: text, inputMode: mode } });
      refreshIdeas();
      router.push(`/idea/${idea.id}?go=1`);
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  const recLabel = rec.state === "recording" ? tr("recording") : rec.state === "busy" || status ? status || tr("transcribing") : tr("holdToTalk");

  return (
    <div className="page">
      <header className="topbar mobile-only" style={{ display: "flex" }}>
        <Link href="/" className="brand" style={{ fontSize: "var(--text-lg)" }}>Idea2Proto<span className="brand-dot">.</span></Link>
      </header>
      <div className="capture">
        {spec ? (
          <SpecReview spec={spec} setSpec={setSpec} onGenerate={generate} onReset={() => { setSpec(null); setText(""); }} busy={busy} />
        ) : (
          <>
            <div className="capture-hero">
              <h1>{tr("heroTitle")}</h1>
              <p>{tr("heroSub")}</p>
              {demo && <p className="faint" style={{ fontSize: "var(--text-xs)", marginTop: 8 }}>{tr("demoMode")}</p>}
            </div>
            <div className="voice-wrap">
              <button
                className="voice-btn"
                data-state={busy ? "busy" : rec.state}
                onClick={rec.toggle}
                disabled={busy || rec.state === "busy"}
                aria-label={rec.state === "recording" ? "Stop recording" : "Start voice capture"}
                aria-pressed={rec.state === "recording"}
              >
                {rec.state === "recording" ? <Stop size={40} /> : <Mic size={44} strokeWidth={1.6} />}
              </button>
              <div className="voice-hint" aria-live="polite">
                {rec.error ? <span className="error">{tr("micDenied")}</span> : recLabel}
                {rec.state === "recording" && ` · ${Math.floor(rec.elapsed / 1000)}s`}
              </div>
            </div>
            <form
              className="capture-alt"
              onSubmit={(e) => { e.preventDefault(); if (text.trim().length > 1) structure(text.trim(), "text"); }}
            >
              <button type="button" className="icon-btn" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", height: 52, width: 52, borderRadius: "var(--radius-lg)" }} onClick={() => fileRef.current?.click()} aria-label={tr("photo")} disabled={busy}>
                <Camera />
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
              <label htmlFor="idea-text" className="sr-only">{tr("typeInstead")}</label>
              <textarea
                id="idea-text"
                ref={taRef}
                className="textarea"
                rows={1}
                placeholder={tr("typeInstead")}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button type="submit" className="send-btn" style={{ height: 52, width: 52, borderRadius: "var(--radius-lg)" }} disabled={busy || text.trim().length < 2} aria-label={tr("send")}>
                <Send />
              </button>
            </form>
            {ideas.length > 0 && (
              <div className="capture-recent mobile-only" style={{ display: "block" }}>
                <h2>{tr("recent")}</h2>
                {ideas.slice(0, 3).map((i) => (
                  <Link key={i.id} href={`/idea/${i.id}`} className="entry">
                    <p className="entry-title">{i.title}</p>
                    <p className="entry-sub" style={{ margin: 0 }}>{i.oneLiner}</p>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
