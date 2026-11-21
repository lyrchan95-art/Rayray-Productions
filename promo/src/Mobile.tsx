import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { C, FONT } from './brand';
import { CaptionCard, EndCard, FontGate, Footage, LedPlate, StopFlag, StripeWipe } from './components';

// 9:16, 30fps, 15s. Every cut is on a beat at 120 BPM (15 frames).
export const MOBILE = { width: 1080, height: 1920, fps: 30, frames: 450 };

const SHOTS = [
  { id: 'm1_hook', from: 0, dur: 60 },
  { id: 'm2_gate', from: 60, dur: 75 },
  { id: 'm3_tools', from: 135, dur: 75 },
  { id: 'm4_billboard', from: 210, dur: 75 },
  { id: 'm5_gallery', from: 285, dur: 60 },
  { id: 'm6_pier', from: 345, dur: 45 }
];
const END_FROM = 390;

// Text stays inside the Reels/TikTok safe area: nothing above y=250 or below y=1540.
const CAPTIONS: { shot: string; kicker: string; text: string; flag?: [string, string] }[] = [
  { shot: 'm2_gate', kicker: 'Module 1', text: 'Plan it in plain English' },
  { shot: 'm3_tools', kicker: 'Tool Workshop', text: 'Pick the right AI tool', flag: ['北潭涌', 'Pak Tam Chung'] },
  { shot: 'm4_billboard', kicker: 'Follow along', text: 'Watch the builds on Instagram', flag: ['萬宜水庫東壩', 'East Dam'] },
  { shot: 'm5_gallery', kicker: 'App Gallery', text: 'Then build your own apps', flag: ['大網仔', 'Tai Mong Tsai'] },
  { shot: 'm6_pier', kicker: 'Sai Kung Pier', text: 'Last stop: the waitlist', flag: ['西貢碼頭', 'Sai Kung Pier'] }
];

export const Mobile: React.FC = () => (
  <FontGate>
    <AbsoluteFill style={{ background: C.ink, fontFamily: FONT }}>
      {SHOTS.map(s => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur}><Footage file={s.id} zoomTo={s.id === 'm1_hook' ? 1.0 : 1.05} /></Sequence>
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

      {[...SHOTS.slice(1).map(s => s.from), END_FROM].map(cut => (
        <Sequence key={cut} from={cut - 5} durationInFrames={10}><StripeWipe len={10} /></Sequence>
      ))}

      <Sequence from={END_FROM} durationInFrames={MOBILE.frames - END_FROM}><EndCard layout="mobile" drawFrames={36} /></Sequence>
      <Audio src={staticFile('audio/route92-mobile.wav')} />
    </AbsoluteFill>
  </FontGate>
);
