"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { langOf, t, type Key, type Lang } from "@/lib/i18n";
import type { Idea, Register } from "@/lib/types";
import { Book, Gear, Moon, Plus, Search, Sidebar as SidebarIcon, Sun } from "./icons";

export interface ShellUser { id: string; name: string | null; email: string; plan: "free" | "pro"; register: Register }
interface Usage { used: number; limit: number }

interface Ctx {
  user: ShellUser;
  setRegister(r: Register): void;
  lang: Lang;
  tr(k: Key): string;
  usage: Usage;
  bumpUsage(): void;
  demo: boolean;
  canPublish: boolean;
  ideas: Idea[];
  refreshIdeas(): void;
  toast(msg: string): void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppShell");
  return c;
};

/** Keeps the composer above the on-screen keyboard on iOS Safari (no interactive-widget support). */
function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", `${Math.round(inset)}px`);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
}

export function groupByRecency<T extends { updatedAt: number }>(items: T[], lang: Lang) {
  const day = 86_400_000;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  const groups: { label: string; items: T[] }[] = [
    { label: t(lang, "today"), items: [] },
    { label: t(lang, "yesterday"), items: [] },
    { label: t(lang, "week"), items: [] },
    { label: t(lang, "older"), items: [] },
  ];
  for (const i of items) {
    const g = i.updatedAt >= t0 ? 0 : i.updatedAt >= t0 - day ? 1 : i.updatedAt >= t0 - 7 * day ? 2 : 3;
    groups[g].items.push(i);
  }
  return groups.filter((g) => g.items.length);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const cur = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    setTheme(cur ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  };
  return (
    <button className="icon-btn" onClick={flip} aria-label={theme === "dark" ? "Light theme" : "Dark theme"}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

function SidebarNav({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed(v: boolean): void }) {
  const { ideas, lang, tr, user } = useApp();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? ideas.filter((i) => (i.title + " " + i.oneLiner).toLowerCase().includes(s)) : ideas;
  }, [ideas, q]);

  return (
    <nav className="sidebar" data-collapsed={collapsed} aria-label="Sidebar">
      <div className="sidebar-head">
        <Link href="/" className="brand sidebar-hide-collapsed">Idea2Proto<span className="brand-dot">.</span></Link>
        <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
          <SidebarIcon />
        </button>
      </div>
      <div className="sidebar-section">
        <Link href="/" className="btn btn-block" style={{ justifyContent: collapsed ? "center" : "flex-start" }} aria-label={tr("newChat")}>
          <Plus size={18} /> <span className="sidebar-hide-collapsed">{tr("newChat")}</span>
        </Link>
      </div>
      <div className="sidebar-section sidebar-hide-collapsed" style={{ marginTop: 8 }}>
        <label className="sr-only" htmlFor="sb-search">{tr("search")}</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: 12, color: "var(--color-text-faint)" }}><Search size={18} /></span>
          <input id="sb-search" className="input" style={{ paddingLeft: 36, background: "var(--color-surface)" }} placeholder={tr("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="sidebar-list sidebar-hide-collapsed">
        <Link href="/journal" className="sidebar-item" aria-current={pathname === "/journal" ? "page" : undefined}>
          <Book size={16} style={{ verticalAlign: -3, marginRight: 8 }} />{tr("journal")}
        </Link>
        {groupByRecency(filtered, lang).map((g) => (
          <div key={g.label}>
            <div className="sidebar-group">{g.label}</div>
            {g.items.map((i) => (
              <Link key={i.id} href={`/idea/${i.id}`} className="sidebar-item" aria-current={pathname === `/idea/${i.id}` ? "page" : undefined}>
                {i.title}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="sidebar-foot">
        {menu && (
          <div className="menu" role="menu">
            <Link href="/settings" role="menuitem" onClick={() => setMenu(false)}><Gear size={16} /> {tr("settings")}</Link>
            <a href="/api/me/export" role="menuitem">⤓ Export data</a>
            <button role="menuitem" onClick={signOutClient}>{tr("signOut")}</button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "flex-start", minWidth: 0 }} onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}>
            <span aria-hidden style={{ width: 28, height: 28, borderRadius: 99, background: "var(--color-accent-soft)", color: "var(--color-accent-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600, flexShrink: 0 }}>
              {(user.name || user.email)[0]?.toUpperCase()}
            </span>
            <span className="sidebar-hide-collapsed" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{user.name || user.email}</span>
            {user.plan === "pro" && <span className="tag sidebar-hide-collapsed">Pro</span>}
          </button>
          <span className="sidebar-hide-collapsed"><ThemeToggle /></span>
        </div>
      </div>
    </nav>
  );
}

export async function signOutClient() {
  const { csrfToken } = await fetch("/api/auth/csrf").then((r) => r.json());
  await fetch("/api/auth/signout", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, callbackUrl: "/signin" }),
  });
  window.location.href = "/signin";
}

function BottomNav() {
  const { tr } = useApp();
  const p = usePathname();
  // Inside a workspace the composer owns the bottom edge; the top bar has a back button.
  if (p.startsWith("/idea/")) return null;
  return (
    <nav className="bottom-nav" aria-label="Main">
      <Link href="/" aria-current={p === "/" ? "page" : undefined}><Plus />{tr("home")}</Link>
      <Link href="/journal" aria-current={p === "/journal" || p.startsWith("/idea/") ? "page" : undefined}><Book />{tr("journal")}</Link>
      <Link href="/settings" aria-current={p === "/settings" ? "page" : undefined}><Gear />{tr("settings")}</Link>
    </nav>
  );
}

export function AppShell({ user: initialUser, usage: initialUsage, demo, canPublish, children }: { user: ShellUser; usage: Usage; demo: boolean; canPublish: boolean; children: React.ReactNode }) {
  useKeyboardInset();
  const [user, setUser] = useState(initialUser);
  const [usage, setUsage] = useState(initialUsage);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lang = langOf(user.register);

  const refreshIdeas = useCallback(() => {
    fetch("/api/ideas").then((r) => (r.ok ? r.json() : { ideas: [] })).then((j) => setIdeas(j.ideas));
  }, []);
  useEffect(refreshIdeas, [refreshIdeas]);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sidebar") === "collapsed"); } catch {}
  }, []);
  useEffect(() => { document.documentElement.lang = lang === "en" ? "en" : "zh-HK"; }, [lang]);

  const ctx: Ctx = {
    user,
    setRegister: (register) => {
      setUser((u) => ({ ...u, register }));
      fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ register }) });
    },
    lang,
    tr: (k) => t(lang, k),
    usage,
    bumpUsage: () => setUsage((u) => ({ ...u, used: u.used + 1 })),
    demo,
    canPublish,
    ideas,
    refreshIdeas,
    toast: (msg) => {
      setToastMsg(msg);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
    },
  };

  return (
    <AppCtx.Provider value={ctx}>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="shell">
        <SidebarNav
          collapsed={collapsed}
          setCollapsed={(v) => {
            setCollapsed(v);
            try { localStorage.setItem("sidebar", v ? "collapsed" : "open"); } catch {}
          }}
        />
        <div className="shell-main" id="main">{children}</div>
      </div>
      <BottomNav />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
