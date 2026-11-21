import React from 'react';
import { Composition } from 'remotion';
import { Mobile, MOBILE } from './Mobile';
import { Mobile15, MOBILE15 } from './Mobile15';
import { Desktop, DESKTOP } from './Desktop';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Route92Mobile" component={Mobile} width={MOBILE.width} height={MOBILE.height} fps={MOBILE.fps} durationInFrames={MOBILE.frames} />
    <Composition id="Route92Mobile15" component={Mobile15} width={MOBILE15.width} height={MOBILE15.height} fps={MOBILE15.fps} durationInFrames={MOBILE15.frames} />
    <Composition id="Route92Desktop" component={Desktop} width={DESKTOP.width} height={DESKTOP.height} fps={DESKTOP.fps} durationInFrames={DESKTOP.frames} />
  </>
);
