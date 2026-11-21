// Shot list for the Route 92 promo. Every cut lands on a 0.5s grid so it sits on a beat at 120 BPM.
// Anchors resolve to a road index inside the game:
//   {a:'ctrl', c}  control point c   {a:'gate', k}  Playbook gantry k   {a:'stop', k}  bus stop k
//   {a:'idx', v}   raw road index    di = extra road indices, o = extra metres along the road
// cam types: chase | track | front | static | aerial   (see PAGE_LIB in capture.mjs)

export const FORMATS = {
  mobile: { w: 1080, h: 1920, fps: 30 },
  mobile15: { w: 1080, h: 1920, fps: 30 },
  desktop: { w: 1920, h: 1080, fps: 24 }
};

const shot = (name, dur, fps, o) => ({ name, fps, frames: Math.round(dur * fps), ...o });

export function shotsFor(format) {
  const { fps } = FORMATS[format];
  if (format === 'mobile') {
    // 40s cut: portrait framing of the desktop storyline. Cuts are on a 0.5s grid (beat at 120 BPM).
    const gate = k => shot(`m4_gate${k + 1}`, 1.5, fps, {
      start: { a: 'gate', k, o: -30 }, v0: 17, speed: [[0, 17], [1.5, 17]],
      cam: { type: 'chase', back: 15, up: 3.8, side: k % 2 ? -0.6 : 0.6, lookAhead: 12, lookUp: 5.4, k: 6, fov: 82 }
    });
    return [
      shot('m1_hook', 2.0, fps, {
        start: { a: 'ctrl', c: 7, o: -52 }, v0: 18, speed: [[0, 19], [2, 20]],
        cam: { type: 'static', at: { a: 'ctrl', c: 7, o: -3 }, off: 8.6, up: 1.0, lookUp: 2.2, lead: 2, fov: 68 }
      }),
      // 2.0-6.0 aerial reveal, ends over the bay
      shot('m2_aerial', 4.0, fps, {
        start: { a: 'idx', v: 14 }, v0: 0, speed: [[0, 0], [4, 0]],
        cam: { type: 'aerial', from: [360, 190, -330], via: [-470, 170, -200], to: [-268, 26, 258], lookFrom: [0, 10, 0], lookTo: [-176, 8, 116], dur: 4, fov: 80, sunFocus: [0, 0] }
      }),
      // 6.0-9.0 pulling out of Sai Kung town
      shot('m3_depart', 3.0, fps, {
        start: { a: 'idx', v: 14 }, v0: 0, speed: [[0, 0], [0.5, 0], [2, 9], [3, 12]],
        cam: { type: 'chase', back: 14, up: 5.4, side: 3, lookAhead: 9, lookUp: 3, k: 3.5, fov: 74 }
      }),
      // 9.0-16.5 the five module gantries
      ...[0, 1, 2, 3, 4].map(gate),
      // 16.5-21.5 tool workshop
      shot('m5_tools', 5.0, fps, {
        start: { a: 'stop', k: 0, di: -6 }, v0: 13, speed: [[0, 13], [5, 14]],
        cam: { type: 'chase', back: 12, up: 5.6, side: 3.6, lookAhead: 7, lookUp: 1.6, k: 4, fov: 70 }
      }),
      // 21.5-25.5 East Dam from the sea side
      shot('m6_dam', 4.0, fps, {
        start: { a: 'stop', k: 1, o: -40 }, v0: 16, speed: [[0, 16], [4, 16]],
        cam: { type: 'static', at: { a: 'stop', k: 1, o: -34 }, off: 74, up: 15, lookUp: 2, lead: 0, fov: 74, mixDam: 0.42, driftFwd: 8, driftUp: -0.8 }
      }),
      // 25.5-29.0 Instagram billboard
      shot('m7_billboard', 3.5, fps, {
        start: { a: 'stop', k: 1, o: -46 }, v0: 14, speed: [[0, 14], [3.5, 14]],
        cam: { type: 'chase', back: 13, up: 4.4, side: -3.0, lookAhead: 14, lookSide: -2.4, lookUp: 3.4, k: 4, fov: 90 }
      }),
      // 29.0-32.5 App Gallery
      shot('m8_gallery', 3.5, fps, {
        start: { a: 'stop', k: 2, o: -47 }, v0: 14, speed: [[0, 14], [3.5, 14]],
        cam: { type: 'static', at: { a: 'stop', k: 2, o: -20 }, off: 11, up: 5.6, lookUp: 4.4, lead: 0, fov: 70 }
      }),
      // 32.5-36.0 back to the pier, under the WAITLIST arch
      shot('m9_pier', 3.5, fps, {
        start: { a: 'idx', v: 0, o: -40 }, v0: 15, speed: [[0, 15], [2.4, 15], [3.5, 4]],
        cam: { type: 'chase', back: 14, up: 4.6, side: 0.8, lookAhead: 12, lookUp: 6.2, k: 5, fov: 74 }
      })
    ];
  }
  if (format === 'mobile15') {
    return [
      // 0.0-2.0s HOOK: bus whooshes past a low roadside camera
      shot('m1_hook', 2.0, fps, {
        start: { a: 'ctrl', c: 7, o: -52 }, v0: 18, speed: [[0, 19], [2, 20]],
        cam: { type: 'static', at: { a: 'ctrl', c: 7, o: -3 }, off: 8.6, up: 1.0, lookUp: 2.2, lead: 2, fov: 68 }
      }),
      // 2.0-4.5s Module 01 gantry
      shot('m2_gate', 2.5, fps, {
        start: { a: 'gate', k: 0, o: -34 }, v0: 16, speed: [[0, 16], [2.5, 17]],
        cam: { type: 'chase', back: 15, up: 3.8, side: 0.4, lookAhead: 12, lookUp: 5.4, k: 6, fov: 82 }
      }),
      // 4.5-7.0s Tool Workshop crates
      shot('m3_tools', 2.5, fps, {
        start: { a: 'stop', k: 0, di: 9 }, v0: 13, speed: [[0, 13], [2.5, 14]],
        cam: { type: 'chase', back: 12, up: 5.6, side: 3.6, lookAhead: 7, lookUp: 1.6, k: 4, fov: 70 }
      }),
      // 7.0-9.5s Instagram billboard ahead on the right
      shot('m4_billboard', 2.5, fps, {
        start: { a: 'stop', k: 1, o: -30 }, v0: 14, speed: [[0, 14], [2.5, 14]],
        cam: { type: 'chase', back: 13, up: 4.4, side: -3.0, lookAhead: 14, lookSide: -2.4, lookUp: 3.4, k: 4, fov: 90 }
      }),
      // 9.5-11.5s App Gallery
      shot('m5_gallery', 2.0, fps, {
        start: { a: 'stop', k: 2, o: -26 }, v0: 14, speed: [[0, 14], [2, 14]],
        cam: { type: 'static', at: { a: 'stop', k: 2, o: -20 }, off: 11, up: 5.6, lookUp: 4.4, lead: 0, fov: 70 }
      }),
      // 11.5-13.0s roll under the WAITLIST arch and stop
      shot('m6_pier', 1.5, fps, {
        start: { a: 'idx', v: 0, o: -15 }, v0: 16, speed: [[0, 16], [0.8, 15], [1.5, 6]],
        cam: { type: 'chase', back: 14, up: 4.6, side: 0.8, lookAhead: 12, lookUp: 6.2, k: 5, fov: 74 }
      })
    ];
  }
  const gateShot = k => shot(`d3_gate${k + 1}`, 1.5, fps, {
    start: { a: 'gate', k, o: -27 }, v0: 17, speed: [[0, 17], [1.5, 17]],
    cam: k % 2 === 0
      ? { type: 'chase', back: 13, up: 4.2, side: 0.5, lookAhead: 10, lookUp: 4.6, k: 6, fov: 58 }
      : { type: 'static', at: { a: 'gate', k, o: -14 }, off: 11, up: 2.2, lookUp: 3.4, lead: 6, fov: 60 }
  });
  return [
    // 0.0-7.0s the world: a slow aerial reveal that ends over the bay, looking at the pier and town
    shot('d1_aerial', 7.0, fps, {
      start: { a: 'idx', v: 14 }, v0: 0, speed: [[0, 0], [7, 0]],
      cam: { type: 'aerial', from: [360, 190, -330], via: [-470, 170, -200], to: [-268, 26, 258], lookFrom: [0, 10, 0], lookTo: [-176, 8, 116], dur: 7, fov: 50, sunFocus: [0, 0] }
    }),
    // 7.0-12.0s the bus pulls out of Sai Kung town
    shot('d2_depart', 5.0, fps, {
      start: { a: 'idx', v: 14 }, v0: 0, speed: [[0, 0], [0.8, 0], [3.5, 11], [5, 14]],
      cam: { type: 'chase', back: 16, up: 6, side: 4, lookAhead: 10, lookUp: 3, k: 3.5, fov: 55 }
    }),
    // 12.0-19.5s Playbook modules 01-05, 1.5s each
    ...[0, 1, 2, 3, 4].map(gateShot),
    // 19.5-25.5s Tool Workshop
    shot('d4_tools', 6.0, fps, {
      start: { a: 'stop', k: 0, di: -8 }, v0: 13, speed: [[0, 13], [6, 14]],
      cam: { type: 'chase', back: 14, up: 5.5, side: 4.5, lookAhead: 8, lookUp: 1.8, k: 3.5, fov: 55 }
    }),
    // 25.5-29.5s East Dam from the sea side: hexagon columns and concrete armour blocks, bus on the road behind
    shot('d5_dam', 4.0, fps, {
      start: { a: 'stop', k: 1, o: -40 }, v0: 16, speed: [[0, 16], [4, 16]],
      cam: { type: 'static', at: { a: 'stop', k: 1, o: -34 }, off: 74, up: 15, lookUp: 2, lead: 0, fov: 56, mixDam: 0.42, driftFwd: 8, driftUp: -0.8 }
    }),
    // 29.5-32.5s upper deck front seat past the Instagram billboard
    shot('d6_front', 3.0, fps, {
      start: { a: 'stop', k: 1, o: -34 }, v0: 12, speed: [[0, 12], [3, 12]],
      cam: { type: 'front', fov: 64, yaw: 12 }
    }),
    // 32.5-36.5s App Gallery
    shot('d7_gallery', 4.0, fps, {
      start: { a: 'stop', k: 2, o: -45 }, v0: 14, speed: [[0, 14], [4, 14]],
      cam: { type: 'static', at: { a: 'stop', k: 2, o: -12 }, off: 13, up: 5.4, lookUp: 4.2, lead: 0, fov: 50 }
    }),
    // 36.5-40.5s back to the pier, under the arch, bus stops
    shot('d8_pier', 4.0, fps, {
      start: { a: 'idx', v: 0, o: -27 }, v0: 14, speed: [[0, 14], [1.6, 13], [3.0, 5], [4, 0]],
      cam: { type: 'chase', back: 15, up: 4.8, side: 1, lookAhead: 12, lookUp: 6, k: 4, fov: 58 }
    })
  ];
}
