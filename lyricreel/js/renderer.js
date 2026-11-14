// Canvas renderer: footage + karaoke-style word-by-word lyrics.
import { activeIndex, wordProgress } from './timing.js';

export const W = 1080, H = 1920;
const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MAIN = 86, NEXT = 52;

export class Renderer {
  constructor(canvas) {
    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.highlight = '#ffd23f';
    this.layoutCache = new Map();
  }

  invalidate() { this.layoutCache.clear(); }

  /**
   * @param t  song time in seconds (offset already applied)
   * @param s  { timeline, footage, title, artist }
   */
  draw(t, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (!s.footage || !s.footage.draw(ctx, W, H, t)) this.drawGradient(t);
    this.drawScrim();

    const tl = s.timeline || [];
    const i = activeIndex(tl, t);
    const first = tl[0];

    if (!tl.length || (first && t < first.start - 0.6 && t < 6)) {
      this.drawTitleCard(s.title, s.artist, first ? Math.min(1, (first.start - 0.6 - t) / 0.4) : 1);
    }

    const baseY = H * 0.6;
    if (i >= 0) {
      const line = tl[i];
      const age = t - line.start;
      const out = t > line.end ? Math.max(0, 1 - (t - line.end) / 0.4) : 1;
      const inA = Math.min(1, age / 0.25);
      const alpha = Math.min(inA, out);
      const lay = this.layout(i, line, MAIN);
      const dy = (1 - easeOut(inA)) * 36;
      ctx.globalAlpha = alpha;
      this.drawLine(lay, baseY + dy, t, true);
      const next = tl[i + 1];
      if (next) {
        ctx.globalAlpha = 0.55 * Math.max(alpha, next.start - t < 1.5 ? 1 : 0);
        this.drawLine(this.layout(i + 1, next, NEXT), baseY + lay.height + 40, t, false);
      }
    } else if (first && first.start - t < 3) {
      ctx.globalAlpha = 0.55 * Math.min(1, (3 - (first.start - t)) / 0.5);
      this.drawLine(this.layout(0, first, NEXT), baseY, t, false);
    }
    ctx.restore();
  }

  drawGradient(t) {
    const ctx = this.ctx;
    const a = (t * 12) % 360;
    const g = ctx.createLinearGradient(0, 0, W * Math.cos(a * Math.PI / 180) + W, H);
    g.addColorStop(0, `hsl(${(a + 260) % 360} 60% 22%)`);
    g.addColorStop(1, `hsl(${(a + 320) % 360} 65% 12%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawScrim() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.35, W, H * 0.65);
  }

  drawTitleCard(title, artist, alpha) {
    const ctx = this.ctx;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
    ctx.font = `800 96px ${FONT}`;
    wrap(ctx, title || 'Your song', W * 0.84).forEach((row, k) => ctx.fillText(row, W / 2, H * 0.45 + k * 110));
    ctx.font = `500 56px ${FONT}`;
    ctx.fillStyle = this.highlight;
    if (artist) ctx.fillText(artist, W / 2, H * 0.45 - 130);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /** Break a line's words into centered rows. Cached per line+size. */
  layout(idx, line, size) {
    const key = `${idx}|${size}|${line.text}`;
    const hit = this.layoutCache.get(key);
    if (hit) return hit;
    const ctx = this.ctx;
    ctx.font = `800 ${size}px ${FONT}`;
    const space = ctx.measureText(' ').width;
    const maxW = W * 0.86;
    const rows = [];
    let row = { items: [], width: 0 };
    line.words.forEach((w, wi) => {
      const ww = ctx.measureText(w.text).width;
      const add = row.items.length ? space + ww : ww;
      if (row.items.length && row.width + add > maxW) { rows.push(row); row = { items: [], width: 0 }; }
      row.items.push({ wi, w: ww, x: row.width + (row.items.length ? space : 0) });
      row.width += row.items.length > 1 ? space + ww : ww;
    });
    if (row.items.length) rows.push(row);
    const lh = size * 1.22;
    const lay = { rows, size, lh, height: rows.length * lh, words: line.words };
    this.layoutCache.set(key, lay);
    return lay;
  }

  drawLine(lay, topY, t, karaoke) {
    const ctx = this.ctx;
    ctx.font = `800 ${lay.size}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    lay.rows.forEach((row, r) => {
      const x0 = (W - row.width) / 2;
      const y = topY + r * lay.lh + lay.size;
      for (const it of row.items) {
        const word = lay.words[it.wi];
        const x = x0 + it.x;
        ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 14;
        ctx.fillStyle = karaoke ? 'rgba(255,255,255,0.92)' : '#fff';
        ctx.fillText(word.text, x, y);
        ctx.shadowBlur = 0;
        if (!karaoke) continue;
        const p = wordProgress(word, t);
        if (p <= 0) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 4, y - lay.size * 1.1, (it.w + 8) * p, lay.size * 1.5);
        ctx.clip();
        if (p < 1) { ctx.shadowColor = this.highlight; ctx.shadowBlur = 24; }
        ctx.fillStyle = this.highlight;
        ctx.fillText(word.text, x, y);
        ctx.restore();
      }
    });
  }
}

const easeOut = x => 1 - Math.pow(1 - x, 3);

function wrap(ctx, text, maxW) {
  const rows = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxW) { rows.push(cur); cur = w; } else cur = test;
  }
  if (cur) rows.push(cur);
  return rows.slice(0, 3);
}
