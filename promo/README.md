# Route 92 promo (Remotion)

Two cuts of the RayRayCoding Route 92 promo, built from real footage of the game (`../route92.html`):

| Composition | Size | Length | Output |
|---|---|---|---|
| `Route92Mobile` | 1080x1920, 30fps | 15s | `out/route92-mobile-9x16.mp4` |
| `Route92Desktop` | 1920x1080, 24fps | 45s | `out/route92-desktop-16x9.mp4` |

The storyboard, shot tables, music and delivery notes are in [`CREATIVE-BRIEF.md`](CREATIVE-BRIEF.md).

## How it is made

1. `scripts/capture.mjs` opens a patched copy of the game in headless Chromium, drives the bus on autopilot with a fixed time step and saves HUD-free frames (`frames/`). The game file itself is not modified. Shots are defined in `scripts/shots.mjs`.
2. `scripts/encode-footage.sh` turns each shot's frames into `public/footage/<shot>.mp4`.
3. `scripts/make-audio.py` synthesizes the music bed and sound effects into `public/audio/` (120 BPM, so cuts land on beats at both frame rates).
4. Remotion (`src/`) adds the captions, stop flags, module signs, cut wipes and the end card, then renders.

## Run it

```bash
cd promo
npm install
npx playwright install chromium        # once, for capture

node scripts/capture.mjs mobile        # ~390 frames
node scripts/capture.mjs desktop       # ~970 frames (add --shots d1_aerial,d2_depart to redo some)
scripts/encode-footage.sh
python3 scripts/make-audio.py          # needs numpy + scipy + ffmpeg

npm run studio                         # preview and tweak text and timing
npm run render:mobile
npm run render:desktop
```

On a server with no browser Remotion can use, add `--browser-executable=<path to chrome-headless-shell>` to the render commands.

Capture runs WebGL in software when there is no GPU, which is slow (about 1 second per 1080p frame) but gives smooth footage because time is stepped, not real-time. Use `--scale 0.5` for a fast draft and `--scout` to save three frames per shot for a contact sheet.

## Edit points

- Captions and timing: `src/Mobile.tsx`, `src/Desktop.tsx` (`SHOTS` and `CAPTIONS`).
- Brand colours, module titles and the CTA text: `src/brand.ts`.
- Camera angles, speeds and start points: `scripts/shots.mjs`.
- Swap in licensed music: replace the files in `public/audio/` with a 120 BPM track, or re-time the cuts.
