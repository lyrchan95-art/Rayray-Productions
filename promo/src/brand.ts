// Brand tokens lifted from the Route 92 game so the video and the product match.
export const C = {
  navy: '#1b2a5c',
  navy2: '#2a3c78',
  ink: '#0f1836',
  red: '#d6232f',
  cream: '#f7f1e3',
  amber: '#ffb020',
  pink: '#fde4ec',
  mint: '#e0f4ea',
  sign: '#0b6b3a',
  yellow: '#ffd23f'
};

export const FONT =
  'Figtree, "Noto Sans HK", "PingFang HK", "Noto Sans CJK TC", "Microsoft JhengHei", "WenQuanYi Zen Hei", sans-serif';

// Draft module titles from the course plan (same list as the gantry signs in the game).
export const MODULES: { title: string; zh: string }[] = [
  { title: 'Spec before you prompt', zh: '單元 1' },
  { title: 'Your first build with Claude', zh: '單元 2' },
  { title: 'Logins, data and saving things', zh: '單元 3' },
  { title: 'Fixing what breaks', zh: '單元 4' },
  { title: 'Ship it and share it', zh: '單元 5' }
];

export const CTA = {
  headline: 'Join the waitlist',
  sub: 'DM “VIBE” to @rayraycoding',
  name: 'RayRayCoding',
  tag: 'The vibe coding course'
};

// ---- the island loop, same control points as the game, drawn as a closed Catmull-Rom curve ----
const CTRL: [number, number][] = [
  [-160, 110], [-192, 40], [-172, -40], [-122, -112], [-40, -152], [40, -170], [122, -142],
  [182, -72], [205, 15], [172, 100], [102, 160], [22, 190], [-58, 176], [-118, 160]
];
export const STOP_CTRL = { pier: 0, ptc: 5, dam: 8, tmt: 12 } as const;

export type Loop = { pts: [number, number][]; stopT: Record<string, number>; path: string; angle: (t: number) => number; at: (t: number) => [number, number] };

export function buildLoop(size: number, pad: number): Loop {
  const n = CTRL.length, steps = 28, raw: [number, number][] = [], ctrlAt: number[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n], p1 = CTRL[i], p2 = CTRL[(i + 1) % n], p3 = CTRL[(i + 2) % n];
    ctrlAt.push(raw.length);
    for (let s = 0; s < steps; s++) {
      const u = s / steps, u2 = u * u, u3 = u2 * u;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      raw.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = (size - pad * 2) / Math.max(maxX - minX, maxY - minY);
  const ox = (size - (maxX - minX) * k) / 2 - minX * k, oy = (size - (maxY - minY) * k) / 2 - minY * k;
  const pts = raw.map(([x, y]) => [x * k + ox, y * k + oy] as [number, number]);
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[pts.length];
  const stopT: Record<string, number> = {};
  for (const [name, c] of Object.entries(STOP_CTRL)) stopT[name] = cum[ctrlAt[c]] / total;
  const idx = (t: number) => Math.min(pts.length - 1, Math.max(0, Math.round(t * pts.length)));
  return {
    pts, stopT,
    path: 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z',
    at: t => pts[idx(t)],
    angle: t => { const a = pts[idx(t)], b = pts[(idx(t) + 3) % pts.length]; return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI; }
  };
}
