import { loadAudioFile } from './audio.js';
import { findLyrics, parseLRC, isSynced, toLRC } from './lyrics.js';
import { buildTimeline } from './timing.js';
import { Footage } from './footage.js';
import { Renderer } from './renderer.js';
import { canExport, makeAudioGraph, exportVideo, extFor } from './export.js';

const $ = id => document.getElementById(id);
const audio = $('audio');
const renderer = new Renderer($('canvas'));
const footage = new Footage();

const state = {
  duration: 0, title: '', artist: '',
  lines: [], timeline: [], offset: 0,
  graph: null, exporting: false, scrubbing: false,
};

// ---------- step navigation ----------
function go(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.toggle('active', s.id === `step-${step}`));
  document.querySelectorAll('.steps button').forEach(b => b.classList.toggle('active', b.dataset.step === step));
  if (step !== 'make' && !state.exporting) { audio.pause(); footage.pauseAll(); }
  if (step === 'make') ensureTrim();
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.steps button').forEach(b => b.addEventListener('click', () => go(b.dataset.step)));

function setStatus(el, msg, kind = '') { el.textContent = msg; el.className = `status ${kind}`; }

// ---------- audio graph (needed for hearing + recording) ----------
async function ensureGraph() {
  if (!state.graph) {
    try { state.graph = makeAudioGraph(audio); } catch (e) { console.warn(e); }
  }
  if (state.graph?.ac.state === 'suspended') await state.graph.ac.resume();
}

// ---------- 1. song ----------
$('audioFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus($('songStatus'), 'Reading song…');
  try {
    const info = await loadAudioFile(file, audio);
    Object.assign(state, info);
    $('audioLabel').textContent = `${file.name} · ${fmt(info.duration)}`;
    $('title').value = info.title || '';
    $('artist').value = info.artist || '';
    $('findBtn').disabled = false;
    $('trimStart').value = 0;
    $('trimEnd').value = info.duration.toFixed(1);
    setStatus($('songStatus'), 'Check the title and artist, then find lyrics.', 'ok');
    rebuild();
  } catch (err) {
    setStatus($('songStatus'), err.message, 'warn');
  }
});
['title', 'artist'].forEach(id => $(id).addEventListener('input', () => {
  state[id] = $(id).value.trim();
}));

$('findBtn').addEventListener('click', async () => {
  state.title = $('title').value.trim();
  state.artist = $('artist').value.trim();
  if (!state.title) return setStatus($('songStatus'), 'Enter the song title first.', 'warn');
  $('findBtn').disabled = true;
  setStatus($('songStatus'), 'Searching LRCLIB…');
  let results = [];
  try {
    results = await findLyrics({ title: state.title, artist: state.artist, duration: state.duration });
  } catch (err) {
    setStatus($('lyricsStatus'), `Couldn't reach the lyrics service (${err.message}). Paste lyrics below instead.`, 'warn');
  }
  $('findBtn').disabled = false;
  setStatus($('songStatus'), '');
  showResults(results);
  go('lyrics');
});

// ---------- 2. lyrics ----------
function showResults(results) {
  const box = $('results');
  box.innerHTML = '';
  if (!results.length) {
    if (!$('lyricsStatus').textContent)
      setStatus($('lyricsStatus'), 'No lyrics found. Paste them below, then use Tap to sync.', 'warn');
    return;
  }
  setStatus($('lyricsStatus'), results.length > 1 ? `Found ${results.length} matches — the best one is selected.` : 'Found lyrics.', 'ok');
  results.slice(0, 5).forEach((r, i) => {
    const b = document.createElement('button');
    b.className = 'result-item';
    const name = document.createElement('span');
    name.textContent = `${r.trackName} — ${r.artistName}`;
    const meta = document.createElement('small');
    meta.textContent = `${r.duration ? fmt(r.duration) : ''} · ${r.syncedLyrics ? 'synced' : 'plain'}`;
    b.append(name, meta);
    b.addEventListener('click', () => select(r, b));
    box.append(b);
    if (i === 0) select(r, b);
  });
}
function select(r, btn) {
  document.querySelectorAll('.result-item').forEach(x => x.classList.toggle('selected', x === btn));
  $('lrc').value = r.syncedLyrics || r.plainLyrics || '';
  onLyricsChanged();
}

function onLyricsChanged() {
  state.lines = parseLRC($('lrc').value);
  const badge = $('syncBadge');
  if (!state.lines.length) { badge.textContent = ''; badge.className = 'badge'; }
  else if (isSynced(state.lines)) {
    const words = state.lines.some(l => l.words);
    badge.textContent = words ? 'word-synced' : 'line-synced';
    badge.className = 'badge ok';
  } else { badge.textContent = 'not synced — tap to sync'; badge.className = 'badge warn'; }
  rebuild();
}
$('lrc').addEventListener('input', onLyricsChanged);
$('toFootage').addEventListener('click', () => go('footage'));

// tap-to-sync
const tap = { texts: [], times: [] };
$('tapSyncBtn').addEventListener('click', async () => {
  if (!audio.src) return setStatus($('lyricsStatus'), 'Pick a song first.', 'warn');
  tap.texts = parseLRC($('lrc').value).map(l => l.text).filter(Boolean);
  if (!tap.texts.length) return setStatus($('lyricsStatus'), 'Paste the lyrics first.', 'warn');
  tap.times = [];
  $('tapPanel').hidden = false;
  showTap();
  await ensureGraph();
  audio.currentTime = 0;
  audio.play();
});
function showTap() {
  const i = tap.times.length;
  $('tapNow').textContent = i ? tap.texts[i - 1] : '(waiting for first line)';
  $('tapNext').textContent = tap.texts[i] ? `Next: ${tap.texts[i]}` : 'All lines tapped!';
  $('tapBig').disabled = i >= tap.texts.length;
}
$('tapBig').addEventListener('pointerdown', () => {
  if (tap.times.length >= tap.texts.length) return;
  tap.times.push(Math.max(0, audio.currentTime - 0.1)); // small reaction-time compensation
  showTap();
  if (tap.times.length === tap.texts.length) setTimeout(finishTap, 600);
});
$('tapUndo').addEventListener('click', () => {
  const last = tap.times.pop();
  if (last !== undefined) audio.currentTime = Math.max(0, last - 2);
  showTap();
});
$('tapStop').addEventListener('click', finishTap);
function finishTap() {
  audio.pause();
  $('tapPanel').hidden = true;
  if (!tap.times.length) return;
  const last = tap.times[tap.times.length - 1];
  const rest = tap.texts.length - tap.times.length;
  const lines = tap.texts.map((text, i) => ({
    text,
    time: i < tap.times.length ? tap.times[i]
      : last + ((state.duration - last) * (i - tap.times.length + 1)) / (rest + 1),
  }));
  $('lrc').value = toLRC(lines);
  onLyricsChanged();
  setStatus($('lyricsStatus'), rest ? `Synced ${tap.times.length} lines; the rest were spaced out evenly.` : 'All lines synced.', 'ok');
}

// ---------- 3. footage ----------
$('footageFile').addEventListener('change', async e => {
  await footage.add([...e.target.files]);
  e.target.value = '';
  renderClips();
});
function renderClips() {
  const ul = $('clips');
  ul.innerHTML = '';
  footage.items.forEach((it, i) => {
    const li = document.createElement('li');
    const thumb = it.type === 'video' ? document.createElement('video') : document.createElement('img');
    thumb.src = it.url;
    if (it.type === 'video') { thumb.muted = true; thumb.playsInline = true; thumb.preload = 'metadata'; }
    else thumb.alt = it.name;
    const rm = document.createElement('button');
    rm.textContent = '✕';
    rm.setAttribute('aria-label', `Remove ${it.name}`);
    rm.addEventListener('click', () => { footage.remove(i); renderClips(); });
    li.append(thumb, rm);
    ul.append(li);
  });
}
$('cutMode').addEventListener('change', e => {
  const v = e.target.value;
  footage.mode = v === 'lines' ? 'lines' : 'time';
  if (v !== 'lines') footage.segLen = Number(v);
  footage.segKey = null;
});
$('toMake').addEventListener('click', () => go('make'));

// ---------- 4. preview / style / export ----------
function rebuild() {
  const shifted = state.lines.map(l => ({
    ...l,
    time: l.time === null ? null : l.time + state.offset,
    words: l.words && l.words.map(w => ({ ...w, time: w.time + state.offset })),
  }));
  state.timeline = buildTimeline(shifted, state.duration);
  renderer.invalidate();
  $('scrub').max = state.duration || 1;
}

const COLORS = ['#ffd23f', '#3fe0ff', '#ff5fa2', '#7dff6b', '#ffffff', '#ff8a3d'];
COLORS.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.style.background = c;
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', `Highlight ${c}`);
  b.setAttribute('aria-checked', String(i === 0));
  b.addEventListener('click', () => {
    renderer.highlight = c;
    document.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-checked', String(s === b)));
  });
  $('swatches').append(b);
});

$('offset').addEventListener('input', e => {
  state.offset = Number(e.target.value);
  $('offsetOut').textContent = `${state.offset >= 0 ? '+' : ''}${state.offset.toFixed(2)} s`;
  rebuild();
});

$('playBtn').addEventListener('click', async () => {
  if (!audio.src) return go('song');
  if (audio.paused) { await ensureGraph(); audio.play(); } else audio.pause();
});
audio.addEventListener('play', () => { $('playBtn').textContent = '❚❚'; $('playBtn').setAttribute('aria-label', 'Pause'); });
audio.addEventListener('pause', () => { $('playBtn').textContent = '▶'; $('playBtn').setAttribute('aria-label', 'Play'); });

$('scrub').addEventListener('input', e => { state.scrubbing = true; audio.currentTime = Number(e.target.value); });
$('scrub').addEventListener('change', () => { state.scrubbing = false; });

function ensureTrim() {
  if (Number($('trimEnd').value) <= 0 && state.duration) $('trimEnd').value = state.duration.toFixed(1);
}
$('setStart').addEventListener('click', () => { $('trimStart').value = audio.currentTime.toFixed(1); });
$('setEnd').addEventListener('click', () => { $('trimEnd').value = audio.currentTime.toFixed(1); });

let exportAbort = null;
$('exportBtn').addEventListener('click', async () => {
  if (state.exporting) { exportAbort?.abort(); return; }
  if (!audio.src) return go('song');
  if (!canExport()) {
    alert('This browser can’t record video. Try the latest Chrome, Edge or Safari.');
    return;
  }
  const start = Math.max(0, Number($('trimStart').value) || 0);
  const end = Math.min(state.duration, Number($('trimEnd').value) || state.duration);
  if (end - start < 1) return alert('Make the export at least 1 second long.');
  await ensureGraph();
  if (!state.graph) return alert('Audio recording isn’t available in this browser.');

  state.exporting = true;
  exportAbort = new AbortController();
  $('exportBtn').textContent = 'Cancel export';
  $('exportProg').hidden = false;
  $('exportProg').value = 0;
  $('result').hidden = true;
  try {
    const blob = await exportVideo({
      canvas: $('canvas'), audio, graph: state.graph, start, end,
      signal: exportAbort.signal,
      onProgress: p => { $('exportProg').value = p; },
    });
    showResult(blob);
  } catch (err) {
    if (err.name !== 'AbortError') alert(`Export failed: ${err.message}`);
  } finally {
    state.exporting = false;
    $('exportBtn').textContent = 'Export video';
    $('exportProg').hidden = true;
  }
});

let resultUrl = null;
function showResult(blob) {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(blob);
  const name = `${(state.title || 'lyric-video').replace(/[^\w\- ]+/g, '').trim() || 'lyric-video'}.${extFor(blob.type)}`;
  $('resultVideo').src = resultUrl;
  $('downloadLink').href = resultUrl;
  $('downloadLink').download = name;
  $('result').hidden = false;
  const file = new File([blob], name, { type: blob.type });
  const share = $('shareBtn');
  share.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  share.onclick = () => navigator.share({ files: [file], title: state.title }).catch(() => {});
}

// ---------- render loop ----------
function frame() {
  const onMake = $('step-make').classList.contains('active');
  if (onMake || state.exporting) {
    const t = audio.currentTime || 0;
    footage.update(t, !audio.paused, state.timeline);
    renderer.draw(t, { timeline: state.timeline, footage, title: state.title, artist: state.artist });
    if (!state.scrubbing) $('scrub').value = t;
    $('clock').textContent = `${fmt(t)} / ${fmt(state.duration)}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function fmt(s) {
  s = Math.max(0, s || 0);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// Expose for debugging / automated checks.
window.lyricReel = { state, footage, renderer, audio };
