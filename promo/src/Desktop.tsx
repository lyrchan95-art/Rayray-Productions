import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { C, FONT, MODULES } from './brand';
import { BottomShade, TopShade, EndCard, FontGate, Footage, GreenSign, LedPlate, LowerThird, StopFlag, StripeWipe } from './components';

// 16:9, 24fps, 45s. Every cut is on a beat at 120 BPM (12 frames).
export const DESKTOP = { width: 1920, height: 1080, fps: 24, frames: 1080 };

const SHOTS = [
  { id: 'd1_aerial', from: 0, dur: 168 },
  { id: 'd2_depart', from: 168, dur: 120 },
  { id: 'd3_gate1', from: 288, dur: 36 },
  { id: 'd3_gate2', from: 324, dur: 36 },
  { id: 'd3_gate3', from: 360, dur: 36 },
  { id: 'd3_gate4', from: 396, dur: 36 },
  { id: 'd3_gate5', from: 432, dur: 36 },
  { id: 'd4_tools', from: 468, dur: 144 },
  { id: 'd5_dam', from: 612, dur: 96 },
  { id: 'd6_front', from: 708, dur: 72 },
  { id: 'd7_gallery', from: 780, dur: 96 },
  { id: 'd8_pier', from: 876, dur: 96 }
];
const END_FROM = 972;
const at = (id: string) => SHOTS.find(s => s.id === id)!;
const flagBox = (zh: string, en: string) => <div style={{ position: 'absolute', top: 72, right: 88 }}><StopFlag zh={zh} en={en} scale={0.78} /></div>;
const lower: React.CSSProperties = { position: 'absolute', left: 96, bottom: 92 };

export const Desktop: React.FC = () => (
  <FontGate>
    <AbsoluteFill style={{ background: C.ink, fontFamily: FONT }}>
      {SHOTS.map(s => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur}><Footage file={s.id} zoomTo={s.id === 'd1_aerial' ? 1.0 : 1.05} /></Sequence>
      ))}

      {/* 0-7s the world, then the title */}
      <Sequence from={0} durationInFrames={168}>
        <BottomShade height="55%" strength={0.55} />
        <Sequence from={30}>
          <div style={lower}>
            <div style={{ color: C.amber, fontWeight: 800, fontSize: 26, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18, textShadow: '0 2px 6px rgba(0,0,0,.9), 0 0 18px rgba(0,0,0,.6)' }}>RayRayCoding presents</div>
            <LedPlate text="西貢 SAI KUNG" number="92" size={64} />
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.02em', marginTop: 26, textShadow: '0 4px 24px rgba(0,0,0,.55)' }}>The vibe coding course,<br />as a bus ride.</div>
          </div>
        </Sequence>
      </Sequence>

      <Sequence from={at('d2_depart').from} durationInFrames={at('d2_depart').dur}>
        <BottomShade /><div style={lower}><LowerThird kicker="Sai Kung Pier · 西貢碼頭" title="All aboard." sub="Five modules, one loop around the island." /></div>
      </Sequence>

      {MODULES.map((m, k) => {
        const s = at(`d3_gate${k + 1}`);
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur}>
            <div style={lower}><GreenSign n={String(k + 1).padStart(2, '0')} title={m.title} zh={m.zh} width={900} /></div>
          </Sequence>
        );
      })}

      <Sequence from={at('d4_tools').from} durationInFrames={at('d4_tools').dur}>
        <BottomShade height="60%" />{flagBox('北潭涌', 'Pak Tam Chung')}
        <div style={lower}><LowerThird kicker="Tool Workshop" title="Know which AI tool to reach for" chips={['Claude', 'Cursor', 'Lovable', 'Replit', 'v0', 'GitHub']} /></div>
      </Sequence>

      <Sequence from={at('d5_dam').from} durationInFrames={at('d5_dam').dur}>
        <TopShade />{flagBox('萬宜水庫東壩', 'High Island East Dam')}
        <div style={{ position: 'absolute', left: 96, top: 84 }}><LowerThird kicker="Hexagonal rock columns" title="140 million years in the making" sub="Hong Kong UNESCO Global Geopark" /></div>
      </Sequence>

      <Sequence from={at('d6_front').from} durationInFrames={at('d6_front').dur}>
        <BottomShade /><div style={lower}><LowerThird kicker="Upper deck, front seat" title="Follow the build on Instagram" sub="@rayraycoding" /></div>
      </Sequence>

      <Sequence from={at('d7_gallery').from} durationInFrames={at('d7_gallery').dur}>
        <BottomShade />{flagBox('大網仔', 'Tai Mong Tsai')}
        <div style={lower}><LowerThird kicker="App Gallery" title="Real apps, each with a demo link" sub="Coming soon" /></div>
      </Sequence>

      <Sequence from={at('d8_pier').from} durationInFrames={at('d8_pier').dur}>
        <BottomShade />{flagBox('西貢碼頭', 'Sai Kung Pier')}
        <div style={lower}><LowerThird kicker="Last stop" title="Finish the loop to join the waitlist" /></div>
      </Sequence>

      {[...SHOTS.slice(1).filter(s => s.id !== 'd3_gate2' && s.id !== 'd3_gate3' && s.id !== 'd3_gate4' && s.id !== 'd3_gate5').map(s => s.from), END_FROM].map(cut => (
        <Sequence key={cut} from={cut - 6} durationInFrames={12}><StripeWipe len={12} /></Sequence>
      ))}

      <Sequence from={END_FROM} durationInFrames={DESKTOP.frames - END_FROM}><EndCard layout="desktop" drawFrames={60} /></Sequence>
      <Audio src={staticFile('audio/route92-desktop.wav')} />
    </AbsoluteFill>
  </FontGate>
);
