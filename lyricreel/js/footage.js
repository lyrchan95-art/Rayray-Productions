// User footage: videos and photos cut together under the lyrics.
import { activeIndex } from './timing.js';

export class Footage {
  constructor() {
    this.items = [];        // { type, el, url, name }
    this.mode = 'time';     // 'time' | 'lines'
    this.segLen = 4;        // seconds per clip in 'time' mode
    this.segKey = null;
    this.active = null;     // { item, idx, segStart, segEnd }
  }

  async add(files) {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('video/')) {
        const el = document.createElement('video');
        Object.assign(el, { src: url, muted: true, playsInline: true, loop: true, preload: 'auto' });
        el.setAttribute('playsinline', '');
        await once(el, 'loadeddata').catch(() => {});
        this.items.push({ type: 'video', el, url, name: file.name });
      } else if (file.type.startsWith('image/')) {
        const el = new Image();
        el.src = url;
        await el.decode().catch(() => {});
        this.items.push({ type: 'image', el, url, name: file.name });
      }
    }
    this.segKey = null;
  }

  remove(i) {
    const [it] = this.items.splice(i, 1);
    if (it) { if (it.type === 'video') it.el.pause(); URL.revokeObjectURL(it.url); }
    this.segKey = null;
  }

  segmentAt(t, timeline) {
    if (this.mode === 'lines' && timeline.length) {
      const li = Math.max(0, activeIndex(timeline, t));
      const segStart = li === 0 ? 0 : timeline[li].start;
      const segEnd = timeline[li + 1] ? timeline[li + 1].start : segStart + 8;
      return { idx: li, segStart, segEnd };
    }
    const idx = Math.max(0, Math.floor(t / this.segLen));
    return { idx, segStart: idx * this.segLen, segEnd: (idx + 1) * this.segLen };
  }

  /** Keep the right clip playing in sync with song time t. Call every frame. */
  update(t, playing, timeline) {
    const n = this.items.length;
    if (!n) { this.active = null; return; }
    const seg = this.segmentAt(t, timeline);
    const item = this.items[seg.idx % n];
    const key = `${seg.idx}:${n}`;
    if (key !== this.segKey) {
      if (this.active && this.active.item.type === 'video' && this.active.item !== item) this.active.item.el.pause();
      this.segKey = key;
    }
    this.active = { item, ...seg };
    if (item.type !== 'video') return;
    const v = item.el;
    const dur = v.duration || 1;
    // Each repeat of the same clip starts further in, so loops don't look identical.
    const cycleOffset = (Math.floor(seg.idx / n) * (seg.segEnd - seg.segStart)) % dur;
    const want = ((t - seg.segStart) + cycleOffset) % dur;
    if (playing) {
      if (Math.abs(v.currentTime - want) > 0.35) v.currentTime = want;
      if (v.paused) v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - want) > 0.05) v.currentTime = want;
    }
  }

  pauseAll() { for (const it of this.items) if (it.type === 'video') it.el.pause(); }

  /** Draw the current clip cover-fitted; returns false if nothing was drawn. */
  draw(ctx, W, H, t) {
    const a = this.active;
    if (!a) return false;
    const el = a.item.el;
    const sw = a.item.type === 'video' ? el.videoWidth : el.naturalWidth;
    const sh = a.item.type === 'video' ? el.videoHeight : el.naturalHeight;
    if (!sw || !sh) return false;
    let scale = Math.max(W / sw, H / sh);
    if (a.item.type === 'image') {
      // gentle Ken Burns zoom across the segment
      const p = Math.min(1, Math.max(0, (t - a.segStart) / (a.segEnd - a.segStart || 1)));
      scale *= 1.02 + 0.08 * p;
    }
    const dw = sw * scale, dh = sh * scale;
    ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return true;
  }
}

const once = (el, ev) => new Promise((res, rej) => {
  el.addEventListener(ev, res, { once: true });
  el.addEventListener('error', rej, { once: true });
});
