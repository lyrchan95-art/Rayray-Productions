// Load the user's audio file and guess title/artist from ID3 tags or the filename.

export async function loadAudioFile(file, audioEl) {
  if (audioEl.dataset.url) URL.revokeObjectURL(audioEl.dataset.url);
  const url = URL.createObjectURL(file);
  audioEl.dataset.url = url;
  audioEl.src = url;
  const duration = await new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve(audioEl.duration); };
    const bad = () => { cleanup(); reject(new Error('Could not read this audio file.')); };
    const cleanup = () => {
      audioEl.removeEventListener('loadedmetadata', ok);
      audioEl.removeEventListener('error', bad);
    };
    audioEl.addEventListener('loadedmetadata', ok);
    audioEl.addEventListener('error', bad);
  });
  const tags = await readID3(file).catch(() => ({}));
  const guess = guessFromFilename(file.name);
  return {
    duration,
    title: tags.title || guess.title,
    artist: tags.artist || guess.artist,
  };
}

export function guessFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ')
    .replace(/\s*[([](official|lyrics?|audio|video|hq|hd|remaster(ed)?)[^)\]]*[)\]]/gi, '')
    .trim();
  const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: base };
}

/** Minimal ID3v2.3/2.4 reader for TIT2 (title) and TPE1 (artist). */
export async function readID3(file) {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
  const ver = head[3];
  const size = (head[6] << 21) | (head[7] << 14) | (head[8] << 7) | head[9];
  const buf = new Uint8Array(await file.slice(10, 10 + Math.min(size, 512 * 1024)).arrayBuffer());
  const out = {};
  let p = 0;
  while (p + 10 < buf.length) {
    const id = String.fromCharCode(buf[p], buf[p + 1], buf[p + 2], buf[p + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const fs = ver === 4
      ? (buf[p + 4] << 21) | (buf[p + 5] << 14) | (buf[p + 6] << 7) | buf[p + 7]
      : ((buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]) >>> 0;
    const body = buf.subarray(p + 10, p + 10 + fs);
    if (id === 'TIT2') out.title = decodeText(body);
    if (id === 'TPE1') out.artist = decodeText(body);
    if (out.title && out.artist) break;
    p += 10 + fs;
  }
  return out;
}

function decodeText(b) {
  const enc = b[0];
  const data = b.subarray(1);
  const label = enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : enc === 3 ? 'utf-8' : 'latin1';
  return new TextDecoder(label).decode(data).replace(/\0/g, '').trim();
}
