// Record the canvas + song into a video file, entirely on-device.

// H.264 MP4 first: it's what phones, Instagram and TikTok accept everywhere.
// A bare 'video/mp4' can mean VP9-in-MP4 on Chromium, so it goes after WebM.
const TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

export const pickMime = () =>
  (typeof MediaRecorder !== 'undefined' && TYPES.find(t => MediaRecorder.isTypeSupported(t))) || '';

export const canExport = () =>
  typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;

/** Route the <audio> through WebAudio once so we can both hear it and record it. */
export function makeAudioGraph(audioEl) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  const src = ac.createMediaElementSource(audioEl);
  const dest = ac.createMediaStreamDestination();
  src.connect(ac.destination);
  src.connect(dest);
  return { ac, dest };
}

/**
 * Plays the song from `start` to `end` in real time while recording.
 * The app's render loop must keep drawing during playback.
 */
export function exportVideo({ canvas, audio, graph, start, end, onProgress, signal }) {
  return new Promise(async (resolve, reject) => {
    const mime = pickMime();
    const stream = canvas.captureStream(30);
    graph.dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
    const rec = new MediaRecorder(stream, {
      ...(mime && { mimeType: mime }),
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 192_000,
    });
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getVideoTracks().forEach(tr => tr.stop());
      audio.removeEventListener('timeupdate', tick);
      audio.removeEventListener('ended', finish);
      if (aborted) return reject(new DOMException('Export cancelled', 'AbortError'));
      resolve(new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' }));
    };
    let aborted = false;
    const finish = () => { if (rec.state !== 'inactive') { audio.pause(); rec.stop(); } };
    const tick = () => {
      onProgress?.(Math.min(1, (audio.currentTime - start) / (end - start)));
      if (audio.currentTime >= end) finish();
    };
    signal?.addEventListener('abort', () => { aborted = true; finish(); });

    try {
      if (graph.ac.state === 'suspended') await graph.ac.resume();
      audio.pause();
      audio.currentTime = start;
      await new Promise(r => setTimeout(r, 200)); // let first frame + footage settle
      audio.addEventListener('timeupdate', tick);
      audio.addEventListener('ended', finish);
      rec.start(250);
      await audio.play();
    } catch (e) {
      if (rec.state !== 'inactive') rec.stop();
      reject(e);
    }
  });
}

export const extFor = type => (type.includes('mp4') ? 'mp4' : 'webm');
