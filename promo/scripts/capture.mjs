// Records HUD-free footage from route92.html with a fixed time step, so the video is smooth
// even when WebGL runs in software. The game file is patched in memory only; the original is untouched.
//
//   node scripts/capture.mjs <mobile|desktop> [--shots a,b] [--scale 1] [--scout] [--out frames]
//
// Needs Playwright with Chromium (npx playwright install chromium) and `npm i` for three + fonts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FORMATS, shotsFor } from './shots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules', 'playwright')); }

const args = process.argv.slice(2);
const format = args[0];
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
if (!FORMATS[format]) { console.error('usage: capture.mjs <mobile|desktop> [--shots a,b] [--scale 1] [--scout] [--out dir]'); process.exit(1); }
const scale = Number(opt('scale', 1)), scout = args.includes('--scout'), outRoot = path.resolve(root, opt('out', 'frames'));
const only = opt('shots', '') ? opt('shots', '').split(',') : null;
const F = FORMATS[format];
const W = Math.round(F.w * scale), Hh = Math.round(F.h * scale);

/* ---- patch a copy of the game ---- */
let src = fs.readFileSync(path.resolve(root, '..', 'route92.html'), 'utf8');
const patch = (a, b) => { if (src.split(a).length !== 2) throw new Error('patch anchor missing: ' + a.slice(0, 60)); src = src.replace(a, b); };
patch('(keys.left ? 1 : 0) - (keys.right ? 1 : 0)', '(+keys.left || 0) - (+keys.right || 0)'); // allow analogue steering
patch('prev = now; frame++;', 'prev = now; frame++;\n  if (window.__capturing) { requestAnimationFrame(loop); return; }');
patch('})().catch(err => {', `window.__rr = { T, scene, camera, renderer, canvas, sun, bus, busGroup, busBody, busParts, keys, props, STOPS, gates, floaters, clouds, N, RX, RZ, TX, TZ, RH, LANE, BUS, update, updateProps, placeBus, nearestRoad, roadPt, headingAt, H, idxOfCtrl };\n})().catch(err => {`);
const gameFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rr92-')), 'game.html');
fs.writeFileSync(gameFile, src);

/* ---- local fonts for the in-scene signs (the CDN is blocked in some sandboxes) ---- */
const fontDir = path.join(root, 'node_modules/@fontsource/figtree/files');
const FONT_CSS = [400, 600, 800, 900].map(w => {
  const b64 = fs.readFileSync(path.join(fontDir, `figtree-latin-${w}-normal.woff2`)).toString('base64');
  return `@font-face{font-family:Figtree;font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
}).join('\n');

/* ---- runs inside the page ---- */
const PAGE_LIB = `(() => {
  const R = window.__rr, T = R.T;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x, lerp = (a, b, t) => a + (b - a) * t, sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  let spacing = 0; for (let i = 0; i < R.N; i++) { const j = (i + 1) % R.N; spacing += Math.hypot(R.RX[j] - R.RX[i], R.RZ[j] - R.RZ[i]); } spacing /= R.N;
  const resolve = a => {
    let i; if (a.a === 'idx') i = a.v; else if (a.a === 'ctrl') i = R.idxOfCtrl(a.c); else if (a.a === 'gate') i = R.gates[a.k].i; else if (a.a === 'stop') i = R.STOPS[a.k].i; else throw new Error('anchor ' + a.a);
    i += (a.di || 0) + Math.round((a.o || 0) / spacing);
    return ((i % R.N) + R.N) % R.N;
  };
  let S = null;
  window.__cap = {
    init(spec) {
      window.__capturing = true;
      const i0 = resolve(spec.start); R.placeBus(i0); R.bus.speed = spec.v0 || 0;
      S = { spec, cp: null, lp: null, sp: null };
      R.camera.fov = spec.cam.fov || 58; R.camera.updateProjectionMatrix();
      const front = spec.cam.type === 'front';
      R.busParts.frontGlass.forEach(m => m.visible = !front); R.busParts.bar.visible = front;
      { const i = R.STOPS[1].i, lx = R.TZ[i], lz = -R.TX[i]; let off = 10; while (off < 140 && R.H(R.RX[i] + lx * off, R.RZ[i] + lz * off) > 0.8) off += 2;
        S.dam = { x: R.RX[i] + lx * (off - 4), y: 4, z: R.RZ[i] + lz * (off - 4) }; }
      if (spec.cam.type === 'static') { const j = resolve(spec.cam.at); const p = R.roadPt(j, spec.cam.off); S.sp = { x: p[0], y: R.H(p[0], p[1]) + spec.cam.up, z: p[1], tx: R.TX[j], tz: R.TZ[j] }; }
      if (spec.cam.type === 'aerial') {
        const c = R.sun.shadow.camera; Object.assign(c, { left: -330, right: 330, top: 330, bottom: -330, far: 900 }); c.updateProjectionMatrix();
        R.sun.shadow.mapSize.set(4096, 4096); if (R.sun.shadow.map) { R.sun.shadow.map.dispose(); R.sun.shadow.map = null; }
      }
      return { canvas: [R.canvas.width, R.canvas.height], startIdx: i0, spacing };
    },
    frame(f, render) {
      const spec = S.spec, dt = 1 / spec.fps, t = f * dt, B = R.bus;
      // speed profile + pure-pursuit autopilot (keeps the bus in the kerb lane)
      const pr = spec.speed; let sp = pr[0][1];
      for (let k = 0; k < pr.length - 1; k++) if (t >= pr[k][0]) sp = lerp(pr[k][1], pr[k + 1][1], clamp((t - pr[k][0]) / (pr[k + 1][0] - pr[k][0]), 0, 1));
      if (t >= pr[pr.length - 1][0]) sp = pr[pr.length - 1][1];
      const nr = R.nearestRoad(B.x, B.z, 3);
      if (nr.i >= 0) {
        const la = Math.max(4, Math.round((7 + Math.abs(B.speed) * 0.9) / spacing)), tp = R.roadPt((nr.i + la) % R.N, R.LANE);
        const diff = wrap(Math.atan2(tp[0] - B.x, tp[1] - B.z) - B.h);
        R.keys.left = clamp(diff * 2.4, 0, 1); R.keys.right = clamp(-diff * 2.4, 0, 1);
        S.maxOff = Math.max(S.maxOff || 0, nr.d);
      }
      R.keys.fwd = B.speed < sp - 0.3; R.keys.back = B.speed > sp + 1.2;
      R.update(dt, t * 1000); R.updateProps(dt);
      const tm = t * 1000 + 3000;
      R.floaters.forEach(fl => { fl.g.position.y = 0.15 + Math.sin(tm * 0.0012 + fl.ph) * 0.18; fl.g.rotation.z = Math.sin(tm * 0.0009 + fl.ph) * 0.04; });
      R.clouds.forEach(c => { c.position.x += dt * 2.2; if (c.position.x > 480) c.position.x = -480; });
      // camera
      const c = spec.cam, fx = Math.sin(B.h), fz = Math.cos(B.h), lx = Math.cos(B.h), lz = -Math.sin(B.h);
      const ease = (key, x, y, z, k) => { const p = S[key]; if (!p) return (S[key] = { x, y, z }); const a = 1 - Math.exp(-k * dt); p.x += (x - p.x) * a; p.y += (y - p.y) * a; p.z += (z - p.z) * a; return p; };
      let P, L;
      if (c.type === 'chase') {
        P = ease('cp', B.x - fx * c.back + lx * (c.side || 0), B.y + c.up, B.z - fz * c.back + lz * (c.side || 0), c.k || 5);
        L = ease('lp', B.x + fx * c.lookAhead + lx * (c.lookSide || 0), B.y + c.lookUp, B.z + fz * c.lookAhead + lz * (c.lookSide || 0), 9);
      } else if (c.type === 'track') {
        P = ease('cp', B.x + lx * c.side + fx * (c.fwd || 0), B.y + c.up, B.z + lz * c.side + fz * (c.fwd || 0), c.k || 6);
        L = ease('lp', B.x + fx * (c.lead || 0), B.y + c.lookUp, B.z + fz * (c.lead || 0), 9);
      } else if (c.type === 'front') {
        R.busGroup.updateMatrixWorld(true);
        const p = new T.Vector3(0, 3.7, R.BUS.L / 2 - 0.1), q = new T.Vector3(-30 * Math.tan((c.yaw || 0) * Math.PI / 180), 3.2, R.BUS.L / 2 + 30); R.busBody.localToWorld(p); R.busBody.localToWorld(q);
        P = p; L = q;
      } else if (c.type === 'static') {
        const d = (c.driftFwd || 0) * t, sp0 = S.sp; P = { x: sp0.x + sp0.tx * d, y: sp0.y + (c.driftUp || 0) * t, z: sp0.z + sp0.tz * d }; L = { x: B.x + fx * (c.lead || 0), y: B.y + c.lookUp, z: B.z + fz * (c.lead || 0) };
      } else if (c.type === 'aerial') {
        const u = sm(t / c.dur), m = (a, b) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
        let p = m(c.from, c.to); if (c.via) p = [0, 1, 2].map(k => (1 - u) * (1 - u) * c.from[k] + 2 * u * (1 - u) * c.via[k] + u * u * c.to[k]); const l = m(c.lookFrom, c.lookTo); P = { x: p[0], y: p[1], z: p[2] }; L = { x: l[0], y: l[1], z: l[2] };
      }
      if (c.mixDam) L = { x: lerp(L.x, S.dam.x, c.mixDam), y: lerp(L.y, S.dam.y + 2, c.mixDam), z: lerp(L.z, S.dam.z, c.mixDam) };
      R.camera.position.set(P.x, P.y, P.z); R.camera.lookAt(L.x, L.y, L.z);
      const aerial = c.type === 'aerial', fo = aerial ? { x: c.sunFocus[0], y: 0, z: c.sunFocus[1] } : { x: B.x, y: B.y, z: B.z };
      const sd = aerial ? [-150, 300, 110] : [-60, 120, 45];
      R.sun.position.set(fo.x + sd[0], fo.y + sd[1], fo.z + sd[2]); R.sun.target.position.set(fo.x, fo.y, fo.z);
      if (!render) return null;
      R.renderer.render(R.scene, R.camera);
      return R.canvas.toDataURL('image/jpeg', 0.93);
    },
    stats: () => ({ maxOff: S.maxOff, speed: R.bus.speed, idx: R.nearestRoad(R.bus.x, R.bus.z, 3).i })
  };
  return true;
})()`;

/* ---- drive ---- */
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let list = shotsFor(format);
if (opt('extra', '')) list = (await import(pathToFileURL(path.resolve(opt('extra', ''))).href)).default;
list = list.filter(s => !only || only.includes(s.name));
for (const spec of list) {
  const t0 = Date.now();
  const page = await browser.newPage({ viewport: { width: W, height: Hh }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(root, 'node_modules/three/build/three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: FONT_CSS }));
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(pathToFileURL(gameFile).href);
  await page.waitForFunction(() => window.__rr, null, { timeout: 240000 });
  await page.evaluate(PAGE_LIB);
  const info = await page.evaluate(s => window.__cap.init(s), spec);
  const dir = path.join(outRoot, scout ? 'scout' : format, scout ? '' : spec.name); fs.mkdirSync(dir, { recursive: true });
  const pick = scout ? new Set([0, Math.floor(spec.frames * 0.5), spec.frames - 2]) : null;
  let n = 0;
  for (let f = 0; f < spec.frames; f++) {
    const render = !pick || pick.has(f);
    const data = await page.evaluate(([f, r]) => window.__cap.frame(f, r), [f, render]);
    if (data) { fs.writeFileSync(path.join(dir, scout ? `${spec.name}_${String(n++)}.jpg` : `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64')); }
  }
  const st = await page.evaluate(() => window.__cap.stats());
  console.log(`${spec.name}: ${spec.frames} frames @${F.fps} canvas ${info.canvas.join('x')} spacing ${info.spacing.toFixed(2)}m in ${((Date.now() - t0) / 1000).toFixed(0)}s | lane error max ${st.maxOff.toFixed(1)}m end speed ${st.speed.toFixed(1)} idx ${st.idx}`);
  await page.close();
}
await browser.close();
