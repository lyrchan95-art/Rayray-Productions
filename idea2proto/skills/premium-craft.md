---
id: premium-craft
name: Premium craft
zh: 高級質感
kind: craft
applies: prototype-html
default: on
source: New skill. Rules are calibrated against the quality gate's measurable craft checks (4px rhythm, type scale, radii, colour restraint, every screen reachable) and ship with a reference scaffold that passes them.
summary_zh: 將原型由「一頁網頁」升級成有質感嘅多畫面產品：設計系統、骨架載入、真實內容、完整狀態、一個招牌互動，仲有一份合格示範可以跟。
summary_en: Turns a page into a multi-screen product that feels funded: design system, skeleton loading, real content, full states, one signature interaction, plus a reference scaffold that passes the audit.
---
PREMIUM CRAFT. This must feel like a funded product, not a template.

STRUCTURE
- Build a multi-screen product, not a page. Each screen is <section data-screen="ID" hidden> (the first one is visible). Navigate ONLY with elements carrying data-go="ID". Include the router from the reference scaffold verbatim and never write another one. Persistent navigation (tab bar or header links) carries data-go for every top-level screen.
- Screen ids come from the BLUEPRINT when one is given. Every active blueprint screen must exist and be reachable.

SYSTEM
- Tokens first (:root): paper, ink, tone1, tone2 (light and dark), spacing 4/8/12/16/24/32/48, two radii (4px and 8px), one hairline, one elevation (overlays only), one easing. Nothing outside the tokens. All padding, margin and gap sit on the 4px grid.
- Type: exactly two families. Six sizes only: 12/14/16/20/28/40. Display face for headings and numbers, body face for text. Hierarchy comes from size and weight, never colour alone. Tabular numerals for prices and times.
- Colour: three tones only (tone1, tone2, paper) plus ink; tints come from color-mix. No gradients. tone2 is rare: alerts, destructive actions, one highlight.

DETAIL (what makes it feel expensive)
- First paint shows a skeleton (an opacity pulse, not a shimmer gradient) for 400-600ms, then the real content.
- Real content: 6-10 specific items per list with local names, prices (Intl.NumberFormat zh-HK, HK$), dates and times (Intl.DateTimeFormat zh-HK). Never "Item 1", never lorem.
- Reset browser defaults you do not want (button padding, list margins, fieldset borders): unstyled defaults are the fastest way to look cheap.
- Every interactive element has a pressed state (1px translate), a visible focus ring, a disabled style, and hover only for pointers. Controls (select, checkbox, toggle) are custom-styled, never browser defaults.
- Transitions 120-180ms ease-out. A screen change fades and slides 6px. Respect prefers-reduced-motion.
- States: empty (one line plus the action), error (what happened plus retry), success (a confirmation that names the thing, a toast, and a guarded navigator.vibrate).
- Forms: visible labels, inputmode and autocomplete, inline validation after blur, the primary button disabled until the form is valid.
- One signature moment from the BLUEPRINT (a single memorable interaction), executed with care.
- A wordmark: draw the brand name as a small inline SVG or type lockup in the header unless a logo asset is provided.
- Persist the user's choices in localStorage so the product feels continuous on reload.

VOICE
- Microcopy is specific and short. Buttons say what will happen ("預約 3 月 12 日 下午 3:00"), never "Submit".

REFERENCE SCAFFOLD. Match its structure and level of finish. Keep the router, token block, states and details. Replace ALL content, names, colours and fonts for this product. Never reuse its words.
```html
<!doctype html>
<html lang="zh-HK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Brand</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=Inter:wght@400;500&display=swap">
<style>
:root{--paper:#eeece5;--ink:#1c1b18;--t1:#0c6a56;--t2:#c13a24;--surface:color-mix(in srgb,var(--paper) 55%,#fff);--line:color-mix(in srgb,var(--paper) 80%,var(--ink));--muted:color-mix(in srgb,var(--ink) 74%,var(--paper));
--s1:4px;--s2:8px;--s3:12px;--s4:16px;--s5:24px;--s6:32px;--r1:4px;--r2:8px;--display:"Fraunces",Georgia,serif;--body:Inter,system-ui,sans-serif;--ease:cubic-bezier(.2,.8,.2,1)}
@media (prefers-color-scheme:dark){:root{--paper:#1b1a17;--ink:#ece9e1;--t1:#52c2a4;--t2:#ef7a65;--surface:color-mix(in srgb,var(--paper) 90%,var(--ink))}}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--paper);color:var(--ink);font:400 16px/1.5 var(--body);min-height:100dvh;padding-bottom:calc(72px + env(safe-area-inset-bottom))}
[hidden]{display:none!important}
.wrap{max-width:520px;margin:0 auto;padding:var(--s5) max(var(--s4),env(safe-area-inset-right)) var(--s5) max(var(--s4),env(safe-area-inset-left))}
h1,h2{font-family:var(--display);font-weight:600;letter-spacing:-.01em;margin:0;text-wrap:balance}
h1{font-size:40px;line-height:1.1}h2{font-size:28px;line-height:1.2}
.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 var(--s2)}
.muted{color:var(--muted);font-size:14px;margin:0}
.lead{margin:var(--s3) 0 var(--s5);color:var(--muted);max-width:32ch}
.row{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);width:100%;min-height:64px;padding:var(--s3) 0;background:none;border:0;border-top:1px solid var(--line);color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .15s var(--ease)}
.row:last-child{border-bottom:1px solid var(--line)}
.row b{font-weight:500;display:block}
.price{font-variant-numeric:tabular-nums;font-family:var(--display);font-size:20px}
.btn{min-height:48px;padding:0 var(--s5);border:0;border-radius:var(--r1);background:var(--t1);color:var(--paper);font:500 16px var(--body);transition:transform .12s var(--ease)}
.btn:active{transform:translateY(1px)}.btn[disabled]{opacity:.45}
.field{display:block;margin:var(--s4) 0}.field span{display:block;font-size:14px;margin-bottom:var(--s1)}
input{width:100%;min-height:48px;padding:0 var(--s3);border:1px solid var(--line);border-radius:var(--r1);background:var(--surface);color:var(--ink);font:inherit}
:focus-visible{outline:2px solid var(--t1);outline-offset:2px}
.skel{height:64px;margin-bottom:var(--s2);background:var(--line);border-radius:var(--r1);animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{opacity:.5}}
[data-screen]:not([hidden]){animation:in .18s var(--ease)}
@keyframes in{from{opacity:0;transform:translateY(6px)}}
.tabs{position:fixed;left:0;right:0;bottom:0;display:flex;background:var(--paper);border-top:1px solid var(--ink);padding-bottom:env(safe-area-inset-bottom)}
.tabs button{flex:1;min-height:56px;padding:0;background:none;border:0;color:var(--muted);font:500 12px var(--body)}
.tabs [aria-current="page"]{color:var(--t1)}
.toast{position:fixed;left:var(--s4);right:var(--s4);bottom:calc(72px + env(safe-area-inset-bottom));padding:var(--s3) var(--s4);background:var(--ink);color:var(--paper);border-radius:var(--r1);font-size:14px;animation:in .18s var(--ease)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head>
<body>
<header class="wrap" style="padding-bottom:0"><svg width="112" height="24" viewBox="0 0 112 24" role="img" aria-label="Brand"><rect x="0" y="4" width="16" height="16" fill="#0c6a56"/><text x="24" y="18" font-family="Fraunces,serif" font-size="16" font-weight="600" fill="currentColor">Brand</text></svg></header>
<main class="wrap">
<section data-screen="home" aria-labelledby="t-home">
<p class="eyebrow">This week</p><h1 id="t-home">Headline that states the value</h1><p class="lead">One supporting sentence.</p>
<div id="list" aria-live="polite"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
</section>
<section data-screen="detail" hidden aria-labelledby="t-detail"><p class="eyebrow" id="d-kind"></p><h2 id="t-detail"></h2><p class="lead" id="d-note"></p>
<label class="field"><span>Name</span><input id="who" autocomplete="name" placeholder="Your name"></label>
<button class="btn" id="go" disabled>Confirm</button></section>
<section data-screen="done" hidden aria-labelledby="t-done"><p class="eyebrow">Confirmed</p><h2 id="t-done">Nothing yet</h2><p class="muted" id="done-note">Your confirmed items appear here.</p></section>
</main>
<nav class="tabs" aria-label="Main"><button data-go="home" aria-current="page">Home</button><button data-go="done" aria-current="false">Mine</button></nav>
<div class="toast" id="toast" role="status" hidden></div>
<script>
var ITEMS=[{id:1,name:"Sample item",note:"Specific detail",price:68}],fmt=new Intl.NumberFormat("zh-HK",{style:"currency",currency:"HKD",maximumFractionDigits:0}),sel=null,mine=JSON.parse(localStorage.getItem("mine")||"null");
function toast(m){var t=document.getElementById("toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){t.hidden=true},2400);navigator.vibrate&&navigator.vibrate(12)}
setTimeout(function(){document.getElementById("list").innerHTML=ITEMS.map(function(i){return '<button class="row" data-pick="'+i.id+'" data-go="detail"><span><b>'+i.name+'</b><span class="muted">'+i.note+'</span></span><span class="price">'+fmt.format(i.price)+'</span></button>'}).join("")},500);
document.addEventListener("click",function(e){var p=e.target.closest("[data-pick]");if(p){sel=ITEMS.filter(function(i){return i.id==p.dataset.pick})[0];document.getElementById("d-kind").textContent=fmt.format(sel.price);document.getElementById("t-detail").textContent=sel.name;document.getElementById("d-note").textContent=sel.note}});
document.getElementById("who").addEventListener("input",function(e){document.getElementById("go").disabled=e.target.value.trim().length<2});
document.getElementById("go").addEventListener("click",function(){mine={name:sel.name,who:document.getElementById("who").value.trim()};localStorage.setItem("mine",JSON.stringify(mine));render();toast("Confirmed: "+sel.name);document.querySelector('[data-go="done"]').click()});
function render(){if(mine){document.getElementById("t-done").textContent=mine.name;document.getElementById("done-note").textContent="Reserved for "+mine.who}}render();
(function(){function show(id){document.querySelectorAll("[data-screen]").forEach(function(s){s.hidden=s.dataset.screen!==id});document.querySelectorAll(".tabs [data-go]").forEach(function(b){b.setAttribute("aria-current",b.dataset.go===id?"page":"false")});window.scrollTo(0,0)}
document.addEventListener("click",function(e){var b=e.target.closest("[data-go]");if(b){e.preventDefault();show(b.dataset.go)}});show(document.querySelector("[data-screen]").dataset.screen)})();
</script></body></html>
```
