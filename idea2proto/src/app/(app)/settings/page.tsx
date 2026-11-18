"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/components/api";
import { signOutClient, ThemeToggle, useApp } from "@/components/AppShell";

export default function SettingsPage() {
  const app = useApp();
  const { tr, lang, user, usage, toast } = app;
  const [training, setTraining] = useState<boolean | null>(null);

  useEffect(() => {
    api<{ user: { trainingOptIn: boolean } }>("/api/me").then((j) => setTraining(j.user.trainingOptIn));
    if (new URLSearchParams(location.search).get("upgraded")) toast("Pro ✓");
  }, [toast]);

  const setTrainingOpt = async (v: boolean) => {
    setTraining(v);
    await api("/api/me", { method: "PATCH", json: { trainingOptIn: v } });
  };
  const upgrade = async () => {
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST" });
      location.href = url;
    } catch (e) {
      toast((e as ApiError).message);
    }
  };
  const deleteAccount = async () => {
    const word = lang === "zh" ? "刪除" : "DELETE";
    if (prompt(lang === "zh" ? `你所有 idea、版本同公開連結會永久刪除，冇得復原。輸入「${word}」確認。` : `This permanently deletes all ideas, versions and public links. Type ${word} to confirm.`) !== word) return;
    await api("/api/me", { method: "DELETE" });
    location.href = "/signin";
  };

  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));

  return (
    <div className="page">
      <div className="narrow" style={{ paddingTop: 24 }}>
        <h1>{tr("settings")}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{user.email}</p>

        <section className="settings-section">
          <h2>{lang === "zh" ? "偏好" : "Preferences"}</h2>
          <div className="settings-row">
            <div><strong>{tr("language")}</strong><p>{lang === "zh" ? "介面語言同語音辨識都會跟住轉" : "Also sets UI language and speech recognition"}</p></div>
          </div>
          <div className="segmented" role="group" aria-label={tr("language")}>
            {(["yue", "mixed", "en"] as const).map((r) => (
              <button key={r} aria-pressed={user.register === r} onClick={() => app.setRegister(r)}>{r === "yue" ? "廣東話" : r === "mixed" ? "中英夾雜" : "English"}</button>
            ))}
          </div>
          <div className="settings-row">
            <div><strong>{tr("theme")}</strong></div>
            <ThemeToggle />
          </div>
        </section>

        <section className="settings-section">
          <h2>{lang === "zh" ? "用量同計劃" : "Usage & plan"}</h2>
          <div className="settings-row" style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{user.plan === "pro" ? "Pro" : "Free"}</strong>
              <span className="muted">{usage.used} / {usage.limit} {lang === "zh" ? "則訊息（今日）" : "messages today"}</span>
            </div>
            <div className="meter" role="progressbar" aria-valuenow={usage.used} aria-valuemin={0} aria-valuemax={usage.limit} aria-label="Daily usage"><span style={{ width: `${pct}%` }} /></div>
          </div>
          {user.plan !== "pro" && (
            <>
              <button className="btn btn-primary btn-block btn-lg" onClick={upgrade}>{tr("upgrade")}</button>
              <p className="faint" style={{ fontSize: "var(--text-xs)" }}>{lang === "zh" ? "支援信用卡同 AlipayHK。想用 FPS 轉數快？聯絡我哋啦。" : "Card and AlipayHK supported. FPS: contact us."}</p>
            </>
          )}
        </section>

        <section className="settings-section">
          <h2>{lang === "zh" ? "私隱同資料" : "Privacy & data"}</h2>
          <div className="settings-row">
            <div>
              <strong id="train-l">{lang === "zh" ? "用我嘅內容改善模型" : "Use my content to improve models"}</strong>
              <p>{lang === "zh" ? "預設關閉，你隨時可以更改。" : "Off by default. Change any time."}</p>
            </div>
            <button className="switch" role="switch" aria-checked={!!training} aria-labelledby="train-l" onClick={() => setTrainingOpt(!training)} disabled={training === null} />
          </div>
          <div className="settings-row">
            <div><strong>{lang === "zh" ? "匯出資料" : "Export data"}</strong><p>JSON</p></div>
            <a className="btn" href="/api/me/export">⤓ {lang === "zh" ? "下載" : "Download"}</a>
          </div>
          <div className="settings-row">
            <div><strong>{lang === "zh" ? "收集個人資料聲明（PICS）" : "Privacy notice (PICS)"}</strong></div>
            <a className="btn btn-ghost" href="/welcome?view=1">{lang === "zh" ? "查看" : "View"}</a>
          </div>
        </section>

        <section className="settings-section">
          <button className="btn btn-block" onClick={signOutClient} style={{ marginBottom: 8 }}>{tr("signOut")}</button>
          <button className="btn btn-danger btn-block" onClick={deleteAccount}>{lang === "zh" ? "刪除帳戶" : "Delete account"}</button>
        </section>
      </div>
    </div>
  );
}
