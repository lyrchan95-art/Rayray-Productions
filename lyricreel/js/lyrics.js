// LRCLIB client + LRC parsing.
// LRCLIB (https://lrclib.net) is a free, open database of time-synced lyrics.

const API = 'https://lrclib.net/api';

export async function findLyrics({ title, artist, duration }) {
  // 1) exact lookup by signature
  if (title && artist) {
    const p = new URLSearchParams({ track_name: title, artist_name: artist });
    if (duration) p.set('duration', Math.round(duration));
    try {
      const r = await fetch(`${API}/get?${p}`);
      if (r.ok) {
        const hit = await r.json();
        if (hit && (hit.syncedLyrics || hit.plainLyrics)) return [hit];
      }
    } catch (_) { /* fall through to search */ }
  }
  // 2) fuzzy search, sorted by closest duration, synced first
  const q = [artist, title].filter(Boolean).join(' ');
  if (!q) return [];
  const r = await fetch(`${API}/search?${new URLSearchParams({ q })}`);
  if (!r.ok) throw new Error(`Lyrics search failed (${r.status})`);
  const list = (await r.json()).filter(x => x.syncedLyrics || x.plainLyrics);
  return rankResults(list, duration);
}

export function rankResults(list, duration) {
  const score = x =>
    (x.syncedLyrics ? 0 : 1000) + (duration && x.duration ? Math.abs(x.duration - duration) : 500);
  return [...list].sort((a, b) => score(a) - score(b));
}

const TIME = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const WORD_TAG = /<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/g;
const toSec = (m, s) => Number(m) * 60 + Number(String(s).replace(':', '.'));

/**
 * Parse LRC or plain text.
 * Returns [{ time: number|null, text: string, words: [{time, text}] | null }]
 * - Lines without a timestamp get time: null (plain lyrics).
 * - Enhanced LRC "<mm:ss.xx>word" tags populate `words`.
 * - Metadata tags ([ar:], [ti:], [offset:]) are skipped; [offset:+/-ms] is applied.
 */
export function parseLRC(text) {
  const out = [];
  let offset = 0;
  let anyTimed = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const meta = raw.match(/^\s*\[(ar|ti|al|by|re|ve|length|offset|au|#):?(.*)\]\s*$/i);
    if (meta) {
      if (meta[1].toLowerCase() === 'offset') offset = (parseInt(meta[2], 10) || 0) / 1000;
      continue;
    }
    const times = [...raw.matchAll(TIME)].map(m => toSec(m[1], m[2]));
    let body = raw.replace(TIME, '').trim();
    let words = null;
    if (WORD_TAG.test(body)) {
      WORD_TAG.lastIndex = 0;
      words = [];
      const parts = body.split(WORD_TAG); // [pre, m, s, text, m, s, text...]
      for (let i = 1; i < parts.length; i += 3) {
        for (const w of parts[i + 2].trim().split(/\s+/).filter(Boolean)) {
          words.push({ time: toSec(parts[i], parts[i + 1]) - offset, text: w });
        }
      }
      body = body.replace(WORD_TAG, '').replace(/\s+/g, ' ').trim();
    }
    if (times.length) {
      anyTimed = true;
      for (const t of times) out.push({ time: t - offset, text: body, words });
    } else if (body) {
      out.push({ time: null, text: body, words: null });
    }
  }
  // Mixed files: drop untimed stray lines if most are timed.
  const lines = anyTimed ? out.filter(l => l.time !== null) : out;
  if (anyTimed) lines.sort((a, b) => a.time - b.time);
  return lines;
}

export const isSynced = lines => lines.length > 0 && lines.every(l => l.time !== null);

const pad = n => String(n).padStart(2, '0');
export function formatTime(t) {
  t = Math.max(0, t);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${pad(m)}:${pad(Math.floor(s))}.${pad(Math.floor((s % 1) * 100))}`;
}

export const toLRC = lines =>
  lines.map(l => (l.time === null ? l.text : `[${formatTime(l.time)}] ${l.text}`)).join('\n');
