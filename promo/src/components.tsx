import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill, OffthreadVideo, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing
} from 'remotion';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/800.css';
import '@fontsource/figtree/900.css';
import { C, CTA, FONT, buildLoop } from './brand';

/** Holds the first frame until Figtree is ready, so no frame renders in a fallback face. */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(['400', '600', '800', '900'].map(w => document.fonts.load(`${w} 40px Figtree`)))
      .catch(() => undefined)
      .then(() => continueRender(handle));
  }, [handle]);
  return <>{children}</>;
};

/** Footage from the game with a slow push-in and a light grade. */
export const Footage: React.FC<{ file: string; zoomTo?: number; originX?: string; originY?: string }> = ({ file, zoomTo = 1.06, originX = '50%', originY = '55%' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const z = interpolate(frame, [0, durationInFrames], [1, zoomTo], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <OffthreadVideo
        src={staticFile(`footage/${file}.mp4`)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})`, transformOrigin: `${originX} ${originY}`, filter: 'saturate(1.08) contrast(1.04)' }}
      />
    </AbsoluteFill>
  );
};

/** Red livery stripe that sweeps over each cut. Mount it len/2 frames before the cut. */
export const StripeWipe: React.FC<{ len?: number }> = ({ len = 10 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, len - 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '-10%', height: '120%', width: '46%', left: `${-60 + t * 170}%`, transform: 'skewX(-14deg)', background: C.red, boxShadow: `18px 0 0 ${C.cream}, -18px 0 0 ${C.navy}` }} />
    </AbsoluteFill>
  );
};

/** Bus destination display: amber dots on black, like the sign on the front of the bus. */
export const LedPlate: React.FC<{ text: string; size: number; number?: string; flipAt?: number }> = ({ text, size, number, flipAt = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - flipAt, fps, config: { damping: 16, stiffness: 220 }, durationInFrames: 14 });
  const dots = size / 14;
  const led: React.CSSProperties = {
    color: C.amber, fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap',
    textShadow: `0 0 ${size * 0.18}px rgba(255,176,32,.65)`,
    WebkitMaskImage: 'radial-gradient(circle at center, #000 52%, transparent 60%)', WebkitMaskSize: `${dots}px ${dots}px`
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, background: '#0c0c0c', border: `${size * 0.05}px solid #2b2b2b`, borderRadius: size * 0.2, padding: `${size * 0.22}px ${size * 0.4}px`, transform: `scaleY(${interpolate(s, [0, 1], [0.05, 1])})`, transformOrigin: '50% 50%', opacity: s > 0.02 ? 1 : 0, boxShadow: '0 14px 40px rgba(0,0,0,.35)', fontFamily: FONT }}>
      {number && <span style={{ ...led, fontSize: size * 1.25 }}>{number}</span>}
      <span style={{ ...led, fontSize: size }}>{text}</span>
    </div>
  );
};

/** Rounded cream card with a red kicker, the main caption on mobile. */
export const CaptionCard: React.FC<{ kicker: string; text: string; size?: number; maxWidth?: number; align?: 'center' | 'left' }> = ({ kicker, text, size = 72, maxWidth = 900, align = 'center' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame: frame - 3, fps, config: { damping: 15, stiffness: 170 } });
  const exit = interpolate(frame, [durationInFrames - 5, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start', width: '100%' }}>
      <div style={{ maxWidth, background: C.cream, borderRadius: size * 0.42, padding: `${size * 0.34}px ${size * 0.55}px ${size * 0.38}px`, boxShadow: '0 18px 50px rgba(15,24,54,.35)', transform: `translateY(${interpolate(enter, [0, 1], [60, 0])}px) scale(${interpolate(enter, [0, 1], [0.92, 1])})`, opacity: Math.min(enter, exit), textAlign: align, fontFamily: FONT }}>
        <div style={{ color: C.red, fontWeight: 800, fontSize: size * 0.36, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: size * 0.12 }}>{kicker}</div>
        <div style={{ color: C.navy, fontWeight: 900, fontSize: size, lineHeight: 1.04, letterSpacing: '-0.015em', textWrap: 'balance' as never }}>{text}</div>
      </div>
    </div>
  );
};

/** Hong Kong bus stop flag: red header, white body, route number plate. */
export const StopFlag: React.FC<{ zh: string; en: string; scale?: number }> = ({ zh, en, scale = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 160 } });
  const exit = interpolate(frame, [durationInFrames - 5, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ width: 380 * scale, transform: `translateY(${interpolate(enter, [0, 1], [-40, 0])}px) rotate(${interpolate(enter, [0, 1], [-4, 0])}deg)`, opacity: Math.min(enter, exit), fontFamily: FONT, boxShadow: '0 16px 40px rgba(15,24,54,.35)', borderRadius: 16 * scale, overflow: 'hidden', background: '#fff' }}>
      <div style={{ background: C.red, color: '#fff', textAlign: 'center', padding: `${14 * scale}px 0 ${10 * scale}px`, lineHeight: 1 }}>
        <div style={{ fontSize: 52 * scale, fontWeight: 900 }}>巴士站</div>
        <div style={{ fontSize: 22 * scale, fontWeight: 800, letterSpacing: '0.16em', marginTop: 4 * scale }}>BUS STOP</div>
      </div>
      <div style={{ padding: `${16 * scale}px ${18 * scale}px ${18 * scale}px`, textAlign: 'center', color: C.navy }}>
        <div style={{ fontSize: 44 * scale, fontWeight: 900, lineHeight: 1.1 }}>{zh}</div>
        <div style={{ fontSize: 24 * scale, fontWeight: 800, marginTop: 4 * scale }}>{en}</div>
        <div style={{ display: 'inline-block', marginTop: 12 * scale, background: C.navy, color: C.amber, borderRadius: 8 * scale, padding: `${2 * scale}px ${26 * scale}px`, fontSize: 56 * scale, fontWeight: 900 }}>92</div>
      </div>
    </div>
  );
};

/** Road-sign lower third in the green of the gantries in the game. */
export const GreenSign: React.FC<{ n: string; title: string; zh: string; width?: number }> = ({ n, title, zh, width = 800 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 240 } });
  const exit = interpolate(frame, [durationInFrames - 4, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const u = width / 800;
  return (
    <div style={{ width, display: 'flex', alignItems: 'center', gap: 28 * u, background: C.sign, border: `${7 * u}px solid #fff`, borderRadius: 14 * u, padding: `${22 * u}px ${28 * u}px`, boxShadow: '0 16px 44px rgba(0,0,0,.35)', fontFamily: FONT, transform: `translateX(${interpolate(enter, [0, 1], [-120, 0])}px)`, opacity: Math.min(enter, exit) }}>
      <div style={{ background: C.yellow, color: '#0b1a2e', fontWeight: 900, fontSize: 84 * u, lineHeight: 1, padding: `${12 * u}px ${20 * u}px`, borderRadius: 6 * u }}>{n}</div>
      <div style={{ color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 50 * u, lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontWeight: 700, fontSize: 28 * u, color: '#d7efe0', marginTop: 6 * u }}>{zh} · RayRayCoding Playbook</div>
      </div>
    </div>
  );
};

/** Plain lower-third for the desktop cut. */
export const LowerThird: React.FC<{ kicker: string; title: string; sub?: string; chips?: string[] }> = ({ kicker, title, sub, chips }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame: frame - 2, fps, config: { damping: 18, stiffness: 150 } });
  const exit = interpolate(frame, [durationInFrames - 6, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ fontFamily: FONT, transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: Math.min(enter, exit), maxWidth: 1180 }}>
      <div style={{ color: C.amber, fontWeight: 800, fontSize: 26, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10, textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>{kicker}</div>
      <div style={{ color: '#fff', fontWeight: 900, fontSize: 76, lineHeight: 1.04, letterSpacing: '-0.02em', textShadow: '0 4px 24px rgba(0,0,0,.55)', textWrap: 'balance' as never }}>{title}</div>
      {sub && <div style={{ color: C.cream, fontWeight: 600, fontSize: 34, marginTop: 12, textShadow: '0 2px 14px rgba(0,0,0,.6)' }}>{sub}</div>}
      {chips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
          {chips.map(c => <span key={c} style={{ background: C.cream, color: C.navy, fontWeight: 800, fontSize: 28, borderRadius: 99, padding: '8px 22px' }}>{c}</span>)}
        </div>
      )}
    </div>
  );
};

export const TopShade: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '55%', background: 'linear-gradient(to bottom, rgba(15,24,54,.6), rgba(15,24,54,0))' }} />
);

export const BottomShade: React.FC<{ height?: string; strength?: number }> = ({ height = '48%', strength = 0.62 }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, background: `linear-gradient(to top, rgba(15,24,54,${strength}), rgba(15,24,54,0))` }} />
);

/** The closing lockup. Both formats end on this: route number, wordmark, CTA and handle. */
export const EndCard: React.FC<{ layout: 'mobile' | 'desktop'; drawFrames: number }> = ({ layout, drawFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mobile = layout === 'mobile';
  const size = 720;
  const loop = React.useMemo(() => buildLoop(size, 56), [size]);
  const p = interpolate(frame, [4, drawFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const word = spring({ frame: frame - 6, fps, config: { damping: 15, stiffness: 130 } });
  const cta = spring({ frame: frame - (mobile ? 14 : 34), fps, config: { damping: 12, stiffness: 150 } });
  const bus = loop.at(p % 1), ang = loop.angle(p % 1);
  const stops: [string, string][] = [['pier', 'Sai Kung Pier'], ['ptc', 'Pak Tam Chung'], ['dam', 'East Dam'], ['tmt', 'Tai Mong Tsai']];
  const map = (
    <svg width={mobile ? 700 : 720} height={mobile ? 700 : 720} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <path d={loop.path} fill="none" stroke="rgba(247,241,227,.16)" strokeWidth={26} strokeLinejoin="round" />
      <path d={loop.path} fill="none" stroke={C.cream} strokeWidth={14} strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
      {stops.map(([k]) => {
        const [x, y] = loop.at(loop.stopT[k]); const on = p >= loop.stopT[k] || k === 'pier';
        return <g key={k}><circle cx={x} cy={y} r={on ? 24 : 18} fill={on ? C.amber : C.navy2} stroke="#fff" strokeWidth={7} /></g>;
      })}
      <g transform={`translate(${bus[0]} ${bus[1]}) rotate(${ang})`}>
        <rect x={-30} y={-15} width={60} height={30} rx={8} fill={C.red} stroke="#fff" strokeWidth={5} />
        <rect x={-18} y={-9} width={30} height={18} rx={4} fill={C.cream} />
        <rect x={20} y={-9} width={6} height={18} rx={2} fill={C.amber} />
      </g>
    </svg>
  );
  const lockup = (
    <div style={{ textAlign: mobile ? 'center' : 'left', fontFamily: FONT, opacity: word, transform: `translateY(${interpolate(word, [0, 1], [30, 0])}px)` }}>
      <div style={{ color: C.amber, fontWeight: 800, fontSize: mobile ? 34 : 30, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Route 92 · 九十二號</div>
      <div style={{ color: C.cream, fontWeight: 900, fontSize: mobile ? 138 : 122, letterSpacing: '-0.035em', lineHeight: 1, marginTop: 10 }}>{CTA.name}</div>
      <div style={{ color: C.pink, fontWeight: 600, fontSize: mobile ? 46 : 46, marginTop: 14 }}>{CTA.tag}</div>
    </div>
  );
  const button = (
    <div style={{ opacity: cta, transform: `scale(${interpolate(cta, [0, 1], [0.86, 1])})`, textAlign: mobile ? 'center' : 'left', fontFamily: FONT }}>
      <div style={{ display: 'inline-block', background: C.red, color: '#fff', fontWeight: 900, fontSize: mobile ? 66 : 60, borderRadius: 26, padding: '26px 56px', boxShadow: '0 16px 40px rgba(0,0,0,.35)' }}>{CTA.headline}</div>
      <div style={{ color: C.cream, fontWeight: 700, fontSize: mobile ? 42 : 40, marginTop: 24 }}>{CTA.sub}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 20%, ${C.navy2}, ${C.navy} 55%, ${C.ink})` }}>
      {mobile ? (
        <>
          <div style={{ position: 'absolute', top: 236, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}><LedPlate text="西貢 SAI KUNG" number="92" size={54} /></div>
          <div style={{ position: 'absolute', top: 350, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>{map}</div>
          <div style={{ position: 'absolute', top: 1030, left: 0, right: 0 }}>{lockup}</div>
          <div style={{ position: 'absolute', top: 1290, left: 0, right: 0 }}>{button}</div>
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', left: 130, top: 160 }}>{map}</div>
          <div style={{ position: 'absolute', left: 960, top: 170, right: 90 }}>
            <div style={{ marginBottom: 36 }}><LedPlate text="西貢 SAI KUNG" number="92" size={44} /></div>
            {lockup}
            <div style={{ height: 56 }} />
            {button}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
