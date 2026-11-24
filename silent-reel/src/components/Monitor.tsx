import { useCallback, useEffect, useRef, useState } from "react";
import { FPS, HEIGHT, WIDTH } from "@/lib/schema";
import { drawFrame, sceneAt, type RenderInput } from "@/lib/renderer";

export function timecode(frame: number): string {
  const s = Math.floor(frame / FPS);
  const f = frame % FPS;
  return `00:00:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

export function Monitor({ input, fontsReady }: { input: RenderInput | null; fontsReady: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const frameRef = useRef(0);
  const total = input?.timeline.totalFrames ?? 450;

  const paint = useCallback(
    (f: number) => {
      const c = canvasRef.current;
      if (!c || !input) return;
      drawFrame(c.getContext("2d")!, input, f);
    },
    [input],
  );

  // Repaint when the script/image/fonts change.
  useEffect(() => {
    paint(frameRef.current);
  }, [paint, fontsReady]);

  useEffect(() => {
    if (!playing || !input) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      acc += now - last;
      last = now;
      const step = 1000 / FPS;
      if (acc >= step) {
        const adv = Math.floor(acc / step);
        acc -= adv * step;
        frameRef.current = (frameRef.current + adv) % total;
        paint(frameRef.current);
        setFrame(frameRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, input, paint, total]);

  const seek = (f: number) => {
    frameRef.current = Math.max(0, Math.min(total - 1, f));
    setFrame(frameRef.current);
    paint(frameRef.current);
  };

  const sceneIdx = input ? sceneAt(input.script, input.timeline, frame / FPS) : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") seek(frameRef.current + (e.shiftKey ? FPS : 1));
      else if (e.key === "ArrowLeft") seek(frameRef.current - (e.shiftKey ? FPS : 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="monitor">
      <div className="screen-wrap">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="screen" aria-label="Reel preview" />
        <div className="safe-zone" aria-hidden="true" />
      </div>

      <div className="transport">
        <button
          id="play-toggle"
          className="icon-btn"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
          title="Space"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M7 5l12 7-12 7z" fill="currentColor" />
            </svg>
          )}
        </button>
        <span className="tc">{timecode(frame)}</span>
        <span className="tc dim">/ {timecode(total)}</span>
        <span className="tc dim right">
          F{String(frame).padStart(3, "0")}
        </span>
      </div>

      <input
        id="scrubber"
        type="range"
        className="scrubber"
        min={0}
        max={total - 1}
        value={frame}
        onChange={(e) => {
          setPlaying(false);
          seek(Number(e.target.value));
        }}
        aria-label="Scrub"
      />

      {input && (
        <ol className="scenes" aria-label="Scenes">
          {input.script.scenes.map((s, i) => (
            <li key={s.id} style={{ flexGrow: s.duration }}>
              <button
                className={`scene ${i === sceneIdx ? "on" : ""} role-${s.text.role}`}
                onClick={() => {
                  setPlaying(false);
                  seek(Math.round(input.timeline.starts[i] * FPS) + Math.round(s.duration * FPS * 0.6));
                }}
                title={`${s.text.content}\n${s.text.animation} · ${s.camera.move} · ${s.transitionIn}`}
              >
                <span className="scene-dur">{s.duration.toFixed(1)}s</span>
                <span className="scene-txt">{s.text.content}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
