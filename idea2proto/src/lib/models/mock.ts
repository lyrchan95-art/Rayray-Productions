/**
 * Deterministic offline provider. Used whenever a vendor key is missing so the full loop
 * (capture → structure → generate → iterate → publish) runs in dev, CI and demos.
 */
import { heuristicRoute } from "../skills/heuristics.ts";
import type { CompletionRequest, ModelProvider } from "./provider";

const textOf = (c: CompletionRequest["messages"][number]["content"]) =>
  typeof c === "string" ? c : c.map((p) => (p.type === "text" ? p.text : "")).join(" ");

const lastUser = (req: CompletionRequest) =>
  textOf([...req.messages].reverse().find((m) => m.role === "user")?.content ?? "");

const isYue = (req: CompletionRequest) => /廣東話|Cantonese register/i.test(textOf(req.messages[0]?.content ?? ""));

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function extractSpec(req: CompletionRequest) {
  const all = req.messages.map((m) => textOf(m.content)).join("\n");
  const m = all.match(/<spec>([\s\S]*?)<\/spec>/);
  try {
    return m ? JSON.parse(m[1]) : null;
  } catch {
    return null;
  }
}

/** Accumulate style modifiers from every user turn so iterations compound. */
function modifiers(req: CompletionRequest) {
  const said = req.messages.filter((m) => m.role === "user").map((m) => textOf(m.content)).join(" ").toLowerCase();
  return {
    big: /bigger|larger|大啲|大d/.test(said),
    playful: /playful|fun|好玩|活潑|可愛/.test(said),
    dark: /dark|深色|黑色/.test(said),
    yue: /廣東話|cantonese|中文/.test(said),
  };
}

function title(raw: string) {
  const t = raw.replace(/^(i have an idea|idea:|我有個idea|我想整|幫我整|做個|整個)[:：,，\s]*/i, "").split(/[。.!?！？\n]/)[0].trim();
  return (t.length > 36 ? t.slice(0, 34) + "…" : t) || "Untitled idea";
}

function structure(req: CompletionRequest) {
  const raw = lastUser(req).replace(/^[\s\S]*?<raw>|<\/raw>[\s\S]*$/g, "");
  const r = heuristicRoute(raw);
  const suggested =
    r.scores["game-prototype"] >= 3 ? "game-prototype" : r.scores["design-variants"] >= 2.5 ? "design-variants" : "prototype-html";
  const t = title(raw);
  return JSON.stringify({
    title: t,
    oneLiner: raw.length > 90 ? raw.slice(0, 88) + "…" : raw,
    coreInteraction: suggested === "game-prototype" ? "Tap to act, avoid obstacles, beat your best score" : "Fill in a short form and see an instant result",
    targetUser: "Busy people in Hong Kong using their phone on the go",
    suggestedSkill: suggested,
  });
}

function shell(t: string, body: string, css: string, js = "") {
  return `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(t)}</title><style>${css}</style></head><body>${body}<script>${js}</script></body></html>`;
}

function html(req: CompletionRequest) {
  const spec = extractSpec(req) ?? { title: "Prototype", oneLiner: "", coreInteraction: "" };
  const m = modifiers(req);
  const accent = m.playful ? "#e0458b" : "#0f7b6c";
  const bg = m.dark ? "#16181d" : "#f7f7f5";
  const fg = m.dark ? "#f2f2f0" : "#1b1c1f";
  const scale = m.big ? 1.25 : 1;
  const cta = m.yue ? "即刻試" : "Try it";
  const done = m.yue ? "搞掂！" : "Done!";
  const css = `*{box-sizing:border-box}body{margin:0;font:${16 * scale}px/1.5 system-ui,sans-serif;background:${bg};color:${fg};min-height:100dvh;padding:calc(24px + env(safe-area-inset-top)) 20px 32px}
h1{font-size:${1.9 * scale}em;line-height:1.15;margin:12px 0 8px}p{opacity:.8}.card{background:${m.dark ? "#22252c" : "#fff"};border-radius:${m.playful ? 24 : 14}px;padding:20px;margin:20px 0;box-shadow:0 2px 12px rgba(0,0,0,.08)}
input{width:100%;font:inherit;padding:14px;border-radius:12px;border:1px solid #ccc;margin:6px 0 14px;background:transparent;color:inherit}
button{width:100%;min-height:${52 * scale}px;font:inherit;font-weight:600;border:0;border-radius:${m.playful ? 999 : 12}px;background:${accent};color:#fff}
.tag{display:inline-block;font-size:.8em;padding:4px 10px;border-radius:99px;background:${accent}22;color:${accent}}#out{font-weight:600;margin-top:14px;min-height:1.5em}`;
  const body = `<span class="tag">Prototype</span><h1>${esc(spec.title)}</h1><p>${esc(spec.oneLiner)}</p>
<div class="card"><label>${m.yue ? "你嘅名" : "Your name"}<input id="n" placeholder="Rayray"></label><button id="b">${cta}</button><div id="out" aria-live="polite"></div></div>
<div class="card"><strong>${m.yue ? "核心互動" : "Core interaction"}</strong><p>${esc(spec.coreInteraction || "")}</p><p id="c"></p></div>`;
  const js = `const k='visits';const v=+(localStorage.getItem(k)||0)+1;localStorage.setItem(k,v);document.getElementById('c').textContent='${m.yue ? "開咗" : "Opened"} '+v+'×';
document.getElementById('b').onclick=()=>{const n=document.getElementById('n').value||'friend';document.getElementById('out').textContent='${done} '+n+' 👋'};`;
  return shell(spec.title, body, css, js);
}

function game(req: CompletionRequest) {
  const spec = extractSpec(req) ?? { title: "Tap Game" };
  const m = modifiers(req);
  const accent = m.playful ? "#ff5fa2" : "#2bd4a4";
  const speed = /faster|快啲|harder/.test(lastUser(req).toLowerCase()) ? 1.6 : 1;
  const css = `html,body{margin:0;height:100%;background:#101218;overflow:hidden;touch-action:none;font-family:system-ui,sans-serif;color:#fff}canvas{display:block;width:100vw;height:100dvh}
#hud{position:fixed;top:calc(12px + env(safe-area-inset-top));left:0;right:0;text-align:center;font-weight:700;font-size:20px;pointer-events:none}`;
  const body = `<canvas id="c"></canvas><div id="hud"></div>`;
  const js = `const c=document.getElementById('c'),x=c.getContext('2d'),hud=document.getElementById('hud');let W,H,dpr;function rs(){dpr=devicePixelRatio||1;W=innerWidth;H=innerHeight;c.width=W*dpr;c.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)}addEventListener('resize',rs);rs();
const best=+(localStorage.getItem('best')||0);let s,p,obs,t,over,hi=best;function reset(){s=0;p={x:W/2,y:H-120,tx:W/2};obs=[];t=0;over=false}reset();
function move(e){const pt=e.touches?e.touches[0]:e;p.tx=pt.clientX}c.addEventListener('pointerdown',e=>{if(over)reset();move(e)});c.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')move(e)});
function loop(){t++;x.fillStyle='#101218';x.fillRect(0,0,W,H);if(!over){p.x+=(p.tx-p.x)*.25;if(t%Math.max(14,40-s/5|0)===0)obs.push({x:Math.random()*(W-40)+20,y:-30,r:14+Math.random()*16,v:(2.5+s/40)*${speed}});
for(const o of obs){o.y+=o.v;if(Math.hypot(o.x-p.x,o.y-p.y)<o.r+18){over=true;if(s>hi){hi=s;localStorage.setItem('best',hi)}}}obs=obs.filter(o=>o.y<H+40);s+=1/6}
x.fillStyle='#ff6b6b';for(const o of obs){x.beginPath();x.arc(o.x,o.y,o.r,0,7);x.fill()}x.fillStyle='${accent}';x.beginPath();x.arc(p.x,p.y,18,0,7);x.fill();
hud.textContent=over?'${m.yue ? "輸咗！撳一下再嚟 · 最高" : "Game over — tap to retry · best"} '+hi:Math.floor(s)+' · ${m.yue ? "最高" : "best"} '+hi;requestAnimationFrame(loop)}loop();`;
  return shell(spec.title, body, css, js);
}

function variants(req: CompletionRequest) {
  const spec = extractSpec(req) ?? { title: "Design", oneLiner: "" };
  const looks = [
    { n: "Harbour Calm", bg: "#eef4f3", fg: "#123", ac: "#0f7b6c", f: "Georgia,serif", r: 8 },
    { n: "Neon Night Market", bg: "#14101f", fg: "#fff", ac: "#ff3d81", f: "system-ui,sans-serif", r: 0 },
    { n: "Dim Sum Soft", bg: "#fff4e8", fg: "#3b2a1a", ac: "#e8962e", f: "ui-rounded,system-ui,sans-serif", r: 28 },
    { n: "Mono Brutal", bg: "#ffffff", fg: "#000", ac: "#000", f: "ui-monospace,monospace", r: 0 },
  ];
  const css = `html,body{margin:0;height:100%}.deck{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;height:100dvh}.v{flex:0 0 100vw;scroll-snap-align:start;padding:calc(40px + env(safe-area-inset-top)) 24px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px}
.v h1{font-size:34px;line-height:1.1;margin:0}.v button{min-height:52px;font:inherit;font-weight:700;border:0;padding:0 24px}.lbl{font:600 12px system-ui;letter-spacing:.08em;text-transform:uppercase;opacity:.6}.dots{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;font:12px system-ui;color:#888}`;
  const body =
    `<div class="deck">` +
    looks
      .map(
        (l, i) =>
          `<section class="v" style="background:${l.bg};color:${l.fg};font-family:${l.f}"><div class="lbl">${i + 1}/${looks.length} · ${l.n}</div><h1>${esc(spec.title)}</h1><p>${esc(spec.oneLiner)}</p><button style="background:${l.ac};color:${l.bg};border-radius:${l.r}px">Get started</button><div style="flex:1;border-radius:${l.r}px;background:${l.ac}22"></div></section>`,
      )
      .join("") +
    `</div><div class="dots">← swipe →</div>`;
  return shell(spec.title, body, css);
}

function chat(req: CompletionRequest) {
  const q = lastUser(req);
  return isYue(req)
    ? `（示範模式：未設定模型 API key）\n\n你問：「${q.slice(0, 80)}」。設定 GLM_API_KEY 之後我會用 GLM 認真答你。想整原型嘅話，講「幫我整個網頁」或者「整個小遊戲」就得。`
    : `(Demo mode — no model API key configured.)\n\nYou asked: "${q.slice(0, 80)}". Set GLM_API_KEY for real answers. To build something, say "make a landing page" or "make a small game".`;
}

function code(req: CompletionRequest) {
  const sys = textOf(req.messages[0]?.content ?? "");
  const out = /skill:game-prototype/.test(sys) ? game(req) : /skill:design-variants/.test(sys) ? variants(req) : html(req);
  const note = isYue(req) ? "整好咗，撳預覽試下。想改咩直接講。" : "Here's your prototype — open the preview and tell me what to change.";
  return `${note}\n\n\`\`\`html\n${out}\n\`\`\``;
}

export class MockProvider implements ModelProvider {
  readonly id = "mock";

  async complete(req: CompletionRequest) {
    switch (req.task) {
      case "structure":
      case "vision":
        return structure(req);
      case "classify": {
        const r = heuristicRoute(lastUser(req));
        return JSON.stringify({ skill: r.skill, confidence: r.confidence });
      }
      case "code":
        return code(req);
      default:
        return chat(req);
    }
  }

  async *stream(req: CompletionRequest) {
    const full = await this.complete(req);
    // chunk like a real stream so the UI's streaming path is exercised
    for (let i = 0; i < full.length; i += 48) {
      if (req.signal?.aborted) return;
      yield full.slice(i, i + 48);
      await new Promise((r) => setTimeout(r, 4));
    }
  }
}
