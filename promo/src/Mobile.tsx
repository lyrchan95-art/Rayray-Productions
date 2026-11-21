import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { C, FONT, MODULES } from './brand';
import { CaptionCard, EndCard, FontGate, Footage, LedPlate, StopFlag, StripeWipe } from './components';

// 9:16, 30fps, 40s. Every cut is on a beat at 120 BPM (15 frames).
export const MOBILE = { width: 1080, height: 1920, fps: 30, frames: 1200 };

const SHOTS = [
  { id: 'm1_hook', from: 0, dur: 60 },
  { id: 'm2_aerial', from: 60, dur: 120 },
  { id: 'm3_depart', from: 180, dur: 90 },
  { id: 'm4_gate1', from: 270, dur: 45 },
  { id: 'm4_gate2', from: 315, dur: 45 },
  { id: 'm4_gate3', from: 360, dur: 45 },
  { id: 'm4_gate4', from: 405, dur: 45 },
  { id: 'm4_gate5', from: 450, dur: 45 },
  { id: 'm5_tools', from: 495, dur: 150 },
  { id: 'm6_dam', from: 645, dur: 120 },
  { id: 'm7_billboard', from: 765, dur: 105 },
  { id: 'm8_gallery', from: 870, dur: 105 },
  { id: 'm9_pier', from: 975, dur: 105 }
];
const END_FROM = 1080;

// Cards stay inside the Reels/TikTok safe area (nothing above y=250 or below y=1540) and hold 6 words or fewer.
const CAPTIONS: { shot: string; kicker: string; text: string; flag?: [string, string] }[] = [
  { shot: 'm2_aerial', kicker: 'RayRayCoding presents', text: 'A course you can drive' },
  { shot: 'm3_depart', kicker: 'Sai Kung Pier · 西貢碼頭', text: 'Five stops, one loop' },
  ...MODULES.map((m, k) => ({ shot: `m4_gate${k + 1}`, kicker: `Module ${k + 1}`, text: m.title })),
  { shot: 'm5_tools', kicker: 'Tool Workshop', text: 'Pick the right AI tool', flag: ['北潭涌', 'Pak Tam Chung'] },
  { shot: 'm6_dam', kicker: 'Hexagonal rock columns', text: 'About 140 million years old', flag: ['萬宜水庫東壩', 'East Dam'] },
  { shot: 'm7_billboard', kicker: 'Follow along', text: 'Watch the builds on Instagram', flag: ['萬宜水庫東壩', 'East Dam'] },
  { shot: 'm8_gallery', kicker: 'App Gallery', text: 'Then build your own apps', flag: ['大網仔', 'Tai Mong Tsai'] },
  { shot: 'm9_pier', kicker: 'Last stop', text: 'Finish the loop, join the waitlist', flag: ['西貢碼頭', 'Sai Kung Pier'] }
];

export const Mobile: React.FC = () => (
  <FontGate>
    <AbsoluteFill style={{ background: C.ink, fontFamily: FONT }}>
      {SHOTS.map(s => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur}><Footage file={s.id} zoomTo={s.id === 'm1_hook' || s.id === 'm2_aerial' ? 1.0 : 1.05} /></Sequence>
      ))}

      {/* 0.0-2.0s hook: the line lands on the kick and the snare */}
      <Sequence from={0} durationInFrames={60}>
        <div style={{ position: 'absolute', top: 1190, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}><LedPlate text="DESCRIBE IT." size={92} /></div>
      </Sequence>
      <Sequence from={30} durationInFrames={30}>
        <div style={{ position: 'absolute', top: 1370, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}><LedPlate text="SHIP IT." size={92} /></div>
      </Sequence>

      {CAPTIONS.map(c => {
        const s = SHOTS.find(x => x.id === c.shot)!;
        return (
          <Sequence key={c.shot} from={s.from} durationInFrames={s.dur}>
            {c.flag && <div style={{ position: 'absolute', top: 280, left: 48 }}><StopFlag zh={c.flag[0]} en={c.flag[1]} scale={0.62} /></div>}
            <div style={{ position: 'absolute', top: 1190, left: 48, right: 48 }}><CaptionCard kicker={c.kicker} text={c.text} /></div>
          </Sequence>
        );
      })}

      {[...SHOTS.slice(1).filter(s => !/^m4_gate[2-5]$/.test(s.id)).map(s => s.from), END_FROM].map(cut => (
        <Sequence key={cut} from={cut - 5} durationInFrames={10}><StripeWipe len={10} /></Sequence>
      ))}

      <Sequence from={END_FROM} durationInFrames={MOBILE.frames - END_FROM}><EndCard layout="mobile" drawFrames={60} /></Sequence>
      <Audio src={staticFile('audio/route92-mobile40.wav')} />
    </AbsoluteFill>
  </FontGate>
);
