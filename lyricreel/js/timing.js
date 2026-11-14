// Turn parsed lyric lines into a renderable timeline with per-word timing.

const MAX_LINE = 8;     // a line never stays on screen longer than this (instrumental gaps)
const MIN_WORD = 0.08;

/**
 * @param lines  output of parseLRC
 * @param duration  song length in seconds
 * @returns [{ start, end, text, words: [{text, start, end}], estimated }]
 */
export function buildTimeline(lines, duration) {
  const src = lines.filter(l => l.text && l.text.trim());
  if (!src.length) return [];

  // Unsynced lyrics: spread evenly so the user still gets something to tweak.
  const timed = src.every(l => l.time !== null)
    ? src
    : src.map((l, i) => ({ ...l, time: (duration * i) / src.length, words: null }));

  return timed.map((l, i) => {
    const next = timed[i + 1];
    const start = l.time;
    const hardEnd = next ? next.time : duration || start + 4;
    const end = Math.max(start + 0.3, Math.min(hardEnd, start + MAX_LINE));
    const words = l.words && l.words.length
      ? fromTags(l.words, end)
      : spreadWords(l.text, start, end);
    return { start, end, text: l.text, words, estimated: !(l.words && l.words.length) };
  });
}

function fromTags(words, lineEnd) {
  return words.map((w, i) => ({
    text: w.text,
    start: w.time,
    end: Math.max(w.time + MIN_WORD, i + 1 < words.length ? words[i + 1].time : lineEnd),
  }));
}

/** Distribute a line's sung time across its words, weighted by length (vowel-ish proxy). */
export function spreadWords(text, start, end) {
  const words = text.split(/\s+/).filter(Boolean);
  // Sing for ~85% of the slot; the tail is the breath before the next line.
  const sung = (end - start) * 0.85;
  const weights = words.map(w => 1 + w.replace(/[^\p{L}\p{N}]/gu, '').length);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = start;
  return words.map((w, i) => {
    const d = (sung * weights[i]) / total;
    const word = { text: w, start: t, end: t + d };
    t += d;
    return word;
  });
}

/** Index of the line active at time t (or the last line already started), -1 before first. */
export function activeIndex(timeline, t) {
  let lo = 0, hi = timeline.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** 0..1 fill progress for a word at time t. */
export const wordProgress = (w, t) =>
  t <= w.start ? 0 : t >= w.end ? 1 : (t - w.start) / (w.end - w.start);
