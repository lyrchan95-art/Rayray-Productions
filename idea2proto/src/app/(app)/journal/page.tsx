"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { groupByRecency, useApp } from "@/components/AppShell";
import { SkillIcon, Search } from "@/components/icons";
import { skillLabel } from "@/lib/skills/registry";
import type { Idea } from "@/lib/types";

type Entry = Idea & { messageCount: number; published: boolean };
const FILTERS = ["", "prototype-html", "game-prototype", "design-variants"] as const;

export default function JournalPage() {
  const { tr, lang } = useApp();
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState<string>("");
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (skill) p.set("skill", skill);
      fetch(`/api/ideas?${p}`, { signal: ac.signal }).then((r) => r.json()).then((j) => setEntries(j.ideas)).catch(() => {});
    }, 180);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, skill]);

  const fmt = new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-HK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="page">
      <div className="journal">
        <h1>{tr("journal")}</h1>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: 12, color: "var(--color-text-faint)" }}><Search size={20} /></span>
          <label htmlFor="j-search" className="sr-only">{tr("search")}</label>
          <input id="j-search" type="search" className="input" style={{ paddingLeft: 40 }} placeholder={tr("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="filters" role="group" aria-label="Filter by skill">
          {FILTERS.map((f) => (
            <button key={f || "all"} className="chip" aria-pressed={skill === f} onClick={() => setSkill(f)}>
              {f ? <><SkillIcon skill={f} size={14} /> {skillLabel(f, lang === "zh")}</> : tr("all")}
            </button>
          ))}
        </div>
        {entries === null ? null : entries.length === 0 ? (
          <p className="empty">{q || skill ? tr("noMatch") : tr("noIdeas")}</p>
        ) : (
          groupByRecency(entries, lang).map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="sidebar-group" style={{ paddingLeft: 0 }}>{g.label}</h2>
              {g.items.map((i) => (
                <Link key={i.id} href={`/idea/${i.id}`} className="entry">
                  <p className="entry-title">{i.title}</p>
                  <p className="entry-sub">{i.oneLiner}</p>
                  <div className="entry-meta">
                    <span className="tag"><SkillIcon skill={i.skill} size={11} style={{ verticalAlign: -1 }} /> {skillLabel(i.skill, lang === "zh")}</span>
                    {i.currentVersion && <span>v{i.currentVersion}</span>}
                    <span>{i.messageCount} 💬</span>
                    {i.published && <span>● {lang === "zh" ? "已發佈" : "Live"}</span>}
                    <span>{fmt.format(i.updatedAt)}</span>
                  </div>
                </Link>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
