import React from 'react';
import { Composition } from 'remotion';
import { Mobile, MOBILE } from './Mobile';
import { Desktop, DESKTOP } from './Desktop';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Route92Mobile" component={Mobile} width={MOBILE.width} height={MOBILE.height} fps={MOBILE.fps} durationInFrames={MOBILE.frames} />
    <Composition id="Route92Desktop" component={Desktop} width={DESKTOP.width} height={DESKTOP.height} fps={DESKTOP.fps} durationInFrames={DESKTOP.frames} />
  </>
);
