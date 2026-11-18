"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { skillLabel } from "@/lib/skills/registry";
import type { Idea, Message, Publication, TurnEvent, TurnSkill, Version } from "@/lib/types";
import { api, ApiError, streamTurn } from "./api";
import { ArtifactFrame } from "./ArtifactFrame";
import { useApp } from "./AppShell";
import * as I from "./icons";
import { Prose } from "./Prose";
import { Sheet } from "./Sheet";
import { useRecorder } from "./useRecorder";

type VersionMeta = Omit<Version, "html">;
interface Pending { input: string; skill?: TurnSkill; text: string; chars: number; provider?: string }

export interface WorkspaceProps {
  idea: Idea;
  messages: Message[];
  versions: VersionMeta[];
  currentHtml: string | null;
  publication: Publication | null;
}

export function IdeaWorkspace(props: WorkspaceProps) {
  const app = useApp();
  const { tr, lang, toast } = app;
  const router = useRouter();
  const search = useSearchParams();

  const [idea, setIdea] = useState(props.idea);
  const [messages, setMessages] = useState(props.messages);
  const [versions, setVersions] = useState(props.versions);
  const [viewN, setViewN] = useState<number | null>(props.idea.currentVersion);
  const [htmlCache, setHtmlCache] = useState<Record<number, string>>(
    props.idea.currentVersion && props.currentHtml ? { [props.idea.currentVersion]: props.currentHtml } : {},
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [lastRoute, setLastRoute] = useState<{ skill: TurnSkill; provider: string; model: string; confidence: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);

  // Desktop: split pane open by default when there's an artifact.
  useEffect(() => {
    if (props.idea.currentVersion && matchMedia("(min-width: 900px)").matches) setPanelOpen(true);
  }, [props.idea.currentVersion]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
  }, []);
  useEffect(scrollToEnd, [messages.length, scrollToEnd]);

  const loadVersion = useCallback(async (n: number) => {
    setViewN(n);
    if (htmlCache[n]) return;
    const { version } = await api<{ version: Version }>(`/api/ideas/${idea.id}/versions/${n}`);
    setHtmlCache((c) => ({ ...c, [n]: version.html }));
  }, [htmlCache, idea.id]);

  const send = useCallback(async (body: { input?: string; forceSkill?: TurnSkill; regenerate?: boolean; editMessageId?: string }, display: string) => {
    if (pending) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setPending({ input: display, text: "", chars: 0 });
    // Optimistically trim history for regenerate / edit to mirror the server.
    if (body.regenerate) {
      setMessages((ms) => {
        const i = ms.map((m) => m.role).lastIndexOf("user");
        return i >= 0 ? ms.slice(0, i) : ms;
      });
    } else if (body.editMessageId) {
      setMessages((ms) => ms.slice(0, ms.findIndex((m) => m.id === body.editMessageId)));
    }
    scrollToEnd();
    try {
      for await (const e of streamTurn(idea.id, body, ac.signal) as AsyncGenerator<TurnEvent>) {
        switch (e.type) {
          case "route":
            setLastRoute(e);
            setPending((p) => p && { ...p, skill: e.skill, provider: e.provider });
            break;
          case "user":
            setMessages((ms) => [...ms, e.message]);
            setPending((p) => p && { ...p, input: "" });
            break;
          case "delta":
            setPending((p) => p && { ...p, text: p.text + e.text });
            scrollToEnd();
            break;
          case "progress":
            setPending((p) => p && { ...p, chars: e.chars });
            break;
          case "artifact": {
            const v = e.version;
            setHtmlCache((c) => ({ ...c, [v.n]: v.html }));
            setVersions((vs) => [...vs, { n: v.n, skill: v.skill, note: v.note, createdAt: v.createdAt }]);
            setIdea((i) => ({ ...i, currentVersion: v.n }));
            setViewN(v.n);
            setPanelOpen(true);
            navigator.vibrate?.(20);
            break;
          }
          case "done":
            setMessages((ms) => [...ms, e.message]);
            break;
          case "error":
            toast(e.error);
            break;
        }
      }
      app.bumpUsage();
      app.refreshIdeas();
    } catch (err) {
      const e = err as ApiError;
      if ((err as Error).name !== "AbortError") {
        toast(e.code === "limit" ? tr("limitReached") : e.message);
        if (body.input) setInput(body.input);
      }
    } finally {
      setPending(null);
      abortRef.current = null;
    }
  }, [app, idea.id, pending, scrollToEnd, toast, tr]);

  // Arrived from capture with ?go=1 → generate the first prototype from the confirmed spec.
  useEffect(() => {
    if (started.current || search.get("go") !== "1" || messages.length) return;
    started.current = true;
    router.replace(`/idea/${idea.id}`, { scroll: false });
    const prompt = lang === "zh" ? "按呢個 spec 整第一版原型。" : "Build the first prototype from this spec.";
    send({ input: prompt, forceSkill: idea.spec.suggestedSkill }, prompt);
  }, [idea.id, idea.spec.suggestedSkill, lang, messages.length, router, search, send]);

  const submit = () => {
    const v = input.trim();
    if (!v || pending) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    send({ input: v }, v);
  };

  // Voice iteration: speak → transcript → send.
  const rec = useRecorder(useCallback(async (blob: Blob) => {
    const form = new FormData();
    form.append("audio", blob, "speech");
    try {
      const { text } = await api<{ text: string }>("/api/capture/stt", { method: "POST", body: form });
      if (text) send({ input: text }, text);
    } catch (e) {
      toast((e as Error).message);
    }
  }, [send, toast]));

  const revert = async (n: number) => {
    await api(`/api/ideas/${idea.id}/versions/${n}`, { method: "POST" });
    setIdea((i) => ({ ...i, currentVersion: n }));
    toast(`${tr("version")} ${n} ✓`);
  };

  const feedback = async (m: Message, f: -1 | 1) => {
    const next = m.feedback === f ? 0 : f;
    setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, feedback: next } : x)));
    await api(`/api/ideas/${idea.id}/messages/${m.id}`, { method: "PATCH", json: { feedback: next } });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(tr("copied"));
    } catch {}
  };

  const deleteIdea = async () => {
    if (!confirm(tr("confirmDelete"))) return;
    await api(`/api/ideas/${idea.id}`, { method: "DELETE" });
    app.refreshIdeas();
    router.push("/journal");
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const viewing = viewN ?? idea.currentVersion;
  const viewHtml = viewing ? htmlCache[viewing] : null;
  useEffect(() => {
    if (viewing && !htmlCache[viewing]) loadVersion(viewing);
  }, [viewing, htmlCache, loadVersion]);

  const modelLabel = lastRoute ? `${skillLabel(lastRoute.skill, lang === "zh")} · ${lastRoute.provider}` : skillLabel(idea.skill, lang === "zh");

  return (
    <div className="workspace">
      <div className="chat-pane">
        <header className="topbar">
          <Link href="/journal" className="icon-btn mobile-only" aria-label={tr("journal")}><I.Back /></Link>
          <h1 className="topbar-title">{idea.title}</h1>
          {idea.currentVersion && (
            <button className="icon-btn" onClick={() => setPanelOpen((o) => !o)} aria-label={tr("openPreview")} aria-pressed={panelOpen}><I.Play /></button>
          )}
          <button className="icon-btn" onClick={() => setShareOpen(true)} aria-label={tr("share")} disabled={!idea.currentVersion}><I.Share /></button>
          <button className="icon-btn" onClick={deleteIdea} aria-label={tr("deleteIdea")}><I.Trash /></button>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-col">
            <section className="spec-summary card" aria-label="Spec">
              <span className="tag"><I.SkillIcon skill={idea.skill} size={12} style={{ verticalAlign: -1 }} /> {skillLabel(idea.skill, lang === "zh")}</span>
              <p style={{ margin: "8px 0 0", fontFamily: "var(--font-serif)", fontSize: "var(--text-lg)" }}>{idea.oneLiner}</p>
              <dl>
                <dt>{tr("coreInteraction")}</dt><dd>{idea.spec.coreInteraction}</dd>
                <dt>{tr("targetUser")}</dt><dd>{idea.spec.targetUser}</dd>
              </dl>
            </section>

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="msg msg-user">
                  {editing?.id === m.id ? (
                    <div style={{ width: "100%" }}>
                      <label className="sr-only" htmlFor={`edit-${m.id}`}>{tr("edit")}</label>
                      <textarea id={`edit-${m.id}`} className="textarea" rows={3} value={editing.text} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} autoFocus />
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                        <button className="btn btn-ghost" onClick={() => setEditing(null)}>{tr("cancel")}</button>
                        <button className="btn btn-primary" disabled={!editing.text.trim() || !!pending} onClick={() => { const e = editing; setEditing(null); send({ input: e.text.trim(), editMessageId: e.id }, e.text.trim()); }}>{tr("save")}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bubble">{m.content}</div>
                      <div className="msg-actions">
                        <button className="icon-btn icon-btn-sm" onClick={() => copy(m.content)} aria-label={tr("copy")}><I.Copy size={16} /></button>
                        <button className="icon-btn icon-btn-sm" onClick={() => setEditing({ id: m.id, text: m.content })} aria-label={tr("edit")} disabled={!!pending}><I.Pencil size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div key={m.id} className="msg msg-assistant">
                  {m.skill && m.skill !== "chat" && <div className="route-label"><I.SkillIcon skill={m.skill} size={14} /> {skillLabel(m.skill, lang === "zh")}</div>}
                  <div className="prose"><Prose text={m.content} /></div>
                  {m.versionN && (
                    <button className="artifact-card" onClick={() => { loadVersion(m.versionN!); setPanelOpen(true); }}>
                      <span className="artifact-card-icon"><I.SkillIcon skill={m.skill} /></span>
                      <span style={{ flex: 1 }}>
                        <strong>{idea.title}</strong><br />
                        <span className="muted">{tr("version")} {m.versionN}{m.versionN === idea.currentVersion ? ` · ${tr("current")}` : ""}</span>
                      </span>
                      <I.Play size={18} />
                    </button>
                  )}
                  <div className="msg-actions">
                    <button className="icon-btn icon-btn-sm" onClick={() => copy(m.content)} aria-label={tr("copy")}><I.Copy size={16} /></button>
                    <button className="icon-btn icon-btn-sm" onClick={() => feedback(m, 1)} aria-label={tr("good")} aria-pressed={m.feedback === 1}><I.ThumbUp size={16} /></button>
                    <button className="icon-btn icon-btn-sm" onClick={() => feedback(m, -1)} aria-label={tr("bad")} aria-pressed={m.feedback === -1}><I.ThumbDown size={16} /></button>
                    {m.id === lastAssistantId && (
                      <button className="icon-btn icon-btn-sm" onClick={() => send({ regenerate: true }, "")} aria-label={tr("regenerate")} disabled={!!pending}><I.Refresh size={16} /></button>
                    )}
                  </div>
                </div>
              ),
            )}

            {pending && (
              <>
                {pending.input && <div className="msg msg-user"><div className="bubble">{pending.input}</div></div>}
                <div className="msg msg-assistant">
                  {pending.skill && pending.skill !== "chat" && <div className="route-label"><I.SkillIcon skill={pending.skill} size={14} /> {skillLabel(pending.skill, lang === "zh")}</div>}
                  <div className="prose" aria-live="polite" aria-busy="true">
                    {pending.text ? <Prose text={pending.text} /> : !pending.chars && <span className="typing" aria-label="…"><span /><span /><span /></span>}
                  </div>
                  {pending.chars > 0 && (
                    <div className="progress-line" role="status"><span className="typing"><span /><span /><span /></span>{tr("building")} · {Math.round(pending.chars / 100) / 10}k</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label htmlFor="composer" className="sr-only">{tr("message")}</label>
            <textarea
              id="composer"
              ref={taRef}
              rows={1}
              value={input}
              placeholder={tr("message")}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
              }}
            />
            <div className="composer-row">
              <button type="button" className="composer-model" onClick={() => setModelOpen(true)} aria-label="Routing and language">
                {modelLabel} · {lang === "zh" ? "廣東話" : "EN"}
              </button>
              <button type="button" className="icon-btn icon-btn-sm" onClick={rec.toggle} aria-label={rec.state === "recording" ? "Stop recording" : "Voice"} aria-pressed={rec.state === "recording"} disabled={!!pending || rec.state === "busy"}>
                {rec.state === "recording" ? <I.Stop size={18} /> : <I.Mic size={18} />}
              </button>
              {pending ? (
                <button type="button" className="send-btn" onClick={() => abortRef.current?.abort()} aria-label="Stop"><I.Stop size={16} /></button>
              ) : (
                <button type="submit" className="send-btn" disabled={!input.trim()} aria-label={tr("send")}><I.Send size={18} /></button>
              )}
            </div>
          </form>
        </div>
      </div>

      {panelOpen && viewing && (
        <aside className="artifact-panel" aria-label="Prototype preview">
          <div className="artifact-bar">
            <button className="icon-btn" onClick={() => setPanelOpen(false)} aria-label={tr("close")}><I.X /></button>
            <span className="title">{idea.title}</span>
            <label className="sr-only" htmlFor="ver">{tr("version")}</label>
            <select id="ver" value={viewing} onChange={(e) => loadVersion(Number(e.target.value))}>
              {versions.map((v) => (
                <option key={v.n} value={v.n}>v{v.n}{v.n === idea.currentVersion ? ` · ${tr("current")}` : ""}</option>
              ))}
            </select>
            {viewing !== idea.currentVersion && (
              <button className="btn" style={{ minHeight: 34 }} onClick={() => revert(viewing)}>{tr("revert")}</button>
            )}
            <button className="icon-btn" onClick={() => setShareOpen(true)} aria-label={tr("share")}><I.Share /></button>
          </div>
          <div className="artifact-stage">
            {viewHtml ? <ArtifactFrame html={viewHtml} storageId={idea.id} title={`${idea.title} v${viewing}`} /> : <div className="typing" style={{ margin: "auto" }}><span /><span /><span /></div>}
          </div>
        </aside>
      )}

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} ideaId={idea.id} title={idea.title} initial={props.publication} currentVersion={idea.currentVersion} />

      <Sheet open={modelOpen} onClose={() => setModelOpen(false)} title={tr("language")}>
        <div className="segmented" role="group" aria-label={tr("language")} style={{ marginBottom: 16 }}>
          {(["yue", "mixed", "en"] as const).map((r) => (
            <button key={r} aria-pressed={app.user.register === r} onClick={() => app.setRegister(r)}>
              {r === "yue" ? "廣東話" : r === "mixed" ? "中英夾雜" : "English"}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
          {lang === "zh"
            ? "每句嘢都會自動揀啱用嘅技能同模型：傾偈、廣東話用 GLM，寫 code、整遊戲用 DeepSeek。"
            : "Each message is routed automatically: GLM for chat and Cantonese, DeepSeek for code and games."}
        </p>
        {lastRoute && (
          <p className="faint" style={{ fontSize: "var(--text-xs)" }}>
            Last turn: {lastRoute.skill} · {lastRoute.provider}/{lastRoute.model} · confidence {lastRoute.confidence.toFixed(2)}
          </p>
        )}
        <button className="btn btn-block" onClick={() => setModelOpen(false)}>{tr("close")}</button>
      </Sheet>
    </div>
  );
}

function ShareSheet({ open, onClose, ideaId, title, initial, currentVersion }: { open: boolean; onClose(): void; ideaId: string; title: string; initial: Publication | null; currentVersion: number | null }) {
  const { tr, toast, canPublish } = useApp();
  const [pub, setPub] = useState<(Publication & { qr?: string }) | null>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && pub && !pub.qr) api<{ publication: Publication & { qr: string } | null }>(`/api/ideas/${ideaId}/publish`).then((j) => setPub(j.publication));
  }, [open, pub, ideaId]);

  const publish = async () => {
    setBusy(true);
    try {
      const j = await api<{ publication: Publication & { qr: string } }>(`/api/ideas/${ideaId}/publish`, { method: "POST" });
      setPub(j.publication);
    } catch (e) {
      const err = e as ApiError;
      toast(err.code === "pro" ? tr("proOnly") : err.message);
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    setBusy(true);
    await api(`/api/ideas/${ideaId}/publish`, { method: "DELETE" });
    setPub(null);
    setBusy(false);
  };
  const nativeShare = async () => {
    if (!pub) return;
    try {
      if (navigator.share) await navigator.share({ title, url: pub.url });
      else { await navigator.clipboard.writeText(pub.url); toast(tr("copied")); }
    } catch {}
  };

  return (
    <Sheet open={open} onClose={onClose} title={tr("share")}>
      {pub ? (
        <>
          {pub.qr && <img className="qr" src={pub.qr} alt={`QR code for ${pub.url}`} />}
          <div className="copy-row">
            <label htmlFor="pub-url" className="sr-only">URL</label>
            <input id="pub-url" className="input" readOnly value={pub.url} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={nativeShare}><I.Share size={18} /> {tr("share")}</button>
          </div>
          {pub.versionN !== currentVersion && (
            <button className="btn btn-primary btn-block" onClick={publish} disabled={busy} style={{ marginBottom: 8 }}>{tr("republish")} (v{currentVersion})</button>
          )}
          <button className="btn btn-danger btn-block" onClick={revoke} disabled={busy}>{tr("revoke")}</button>
        </>
      ) : (
        <>
          {!canPublish && <p className="muted">{tr("proOnly")}</p>}
          <button className="btn btn-primary btn-lg btn-block" onClick={publish} disabled={busy || !currentVersion}>{tr("publish")}</button>
          {!canPublish && <Link href="/settings" className="btn btn-block" style={{ marginTop: 8 }}>{tr("upgrade")}</Link>}
        </>
      )}
    </Sheet>
  );
}
