# Idea2Proto: MVP1 "Idea to Prototype"

A mobile-first PWA that turns a spoken (Cantonese-first) idea into a shareable single-file prototype.
Next.js 16 (App Router) · Auth.js v5 · `node:sqlite` · GLM + DeepSeek behind a `ModelProvider` interface.

## Run it

```bash
cd idea2proto
npm install
cp .env.example .env.local   # every key is optional for local dev
npm run dev                  # http://localhost:3000
```

With no model keys the app runs on a **deterministic mock provider**, so the whole loop (capture, spec, generate, iterate, publish, journal) works offline. Set `DEV_LOGIN=1` for one-click sign-in. Without SMTP, magic links are printed to the server log.

Requires Node ≥ 22.5 (built-in SQLite).

## Checks

| Command | What it does |
|---|---|
| `npm test` | unit tests: artifact extraction/repair, CSP + storage-shim injection, router, mock skills |
| `npm run eval:router` | skill-router accuracy on `evals/router.json` (fails below 90%) |
| `npm run brand-check` | greps `src/` + `public/` for third-party assistant brand names, fonts, palette hexes, and raw colours outside `tokens.css` |
| `npm run typecheck` / `npm run build` | |

## Map: PRD → code

| PRD | Where |
|---|---|
| 4.1 Auth, PICS, export, delete | `src/lib/auth/*`, `app/signin`, `app/welcome` (PICS, training opt-in default **off**), `api/me`, `api/me/export` |
| 4.2 Capture (voice / photo / text) | `app/(app)/page.tsx`, `components/useRecorder.ts`, `api/capture/{stt,photo,structure}`, `lib/models/stt.ts` |
| 4.3 Structuring + editable spec | `SpecReview` in home page; `structureIdea` in `lib/skills/engine.ts` |
| 4.4 Skill library + router | `lib/skills/registry.ts` (versioned prompts), `lib/skills/heuristics.ts` + model classifier in `engine.ts`, `evals/*.json` |
| 4.5 Chat & iteration | `components/IdeaWorkspace.tsx`, `api/ideas/[id]/turn` (NDJSON stream; regenerate, edit-and-rerun, feedback). Iterations create new versions |
| 4.6 Artifact runtime | `lib/artifact/runtime.ts` (CSP + storage shim), `components/ArtifactFrame.tsx` (`sandbox="allow-scripts"` only), versions + revert, `api/ideas/[id]/publish` (QR, revoke), `app/p/[slug]` (CSP `sandbox` header), `lib/publish/store.ts` (R2 or local) |
| 4.7 Journal | `app/(app)/journal` + `listIdeas` full-text search over title/spec/raw input/messages, skill filter |
| 4.8 Model router | `lib/models/router.ts`: roles `cheap` / `chat` / `code` / `vision` → GLM / DeepSeek / mock |
| 4.9 Usage & paywall | `lib/usage.ts` (daily limits, reset at HKT midnight), `api/billing/{checkout,webhook}` (Stripe REST, card + Alipay) |
| 5.x Design system & layout | `src/styles/tokens.css` (single token file, warm light/dark via `data-theme`), `app/globals.css`, `components/AppShell.tsx` |
| 5.3 Mobile | bottom nav, safe-area insets, `dvh`, `visualViewport` keyboard inset (`--kb`), bottom sheets, manifest + icons + `public/sw.js` |

## Known gaps / next steps

- **Cantonese STT is unverified.** STT goes to any OpenAI-compatible `/audio/transcriptions` endpoint (GLM-ASR by default, `language=yue`). It has not been tested against real speech. Benchmark it on real founder recordings before beta.
- **Real-model quality is unverified.** No GLM/DeepSeek keys were available, so every end-to-end run used the mock provider. `evals/<skill>.json` holds assertion-based cases, but there is no runner yet for live providers.
- **Router eval is 118 items, not 200**, and was written alongside the heuristics. Expect lower accuracy on real user traffic. Grow it from logged turns.
- **FPS** isn't supported by Stripe. The UI says "contact us" for now. A local PSP integration is needed for AlipayHK/FPS-native flows.
- Publishing defaults to **Pro-only** (`FREE_CAN_PUBLISH=0`), per PRD 4.9. Consider enabling it for beta users, because the 60-second "shareable" metric needs it.
- SQLite fits a single instance. Move to Postgres before running multiple instances.
- The PICS text is a draft. Have counsel review it.

## OpenRouter

Set `OPENROUTER_API_KEY` to switch on live models through one key. OpenRouter serves every role that has no direct `GLM_API_KEY` / `DEEPSEEK_API_KEY` (chat, cheap and vision → GLM slugs, code → DeepSeek slug). The slugs are set in `.env.example`; check them against openrouter.ai/models. In a cloud session, `openrouter.ai` also has to be allowed in the environment's network settings.

## Test artifact

`artifact/idea2proto-live.html` is a standalone, client-only version of the loop for testing on claude.ai. Artifact pages can't make outside network requests, so it runs on the artifact's built-in model access, not GLM/DeepSeek, and keeps ideas in the viewer's browser.

## Imported skills and the quality gate

`skills/*.md` holds the design skills the app injects into generation prompts (head designer, frontend designer, Fable discipline, world weaving, Cantonese copywriter) and the `ux-audit` workflow. `node scripts/build-artifact.mjs` bakes them into `artifact/idea2proto-live.html` from `artifact/idea2proto-live.src.html`. Edit the `.src.html` template, never the built file.

Quality gate, for every artifact turn: design, then measure (a hidden 390px render checks runtime errors, overflow, tap targets, contrast, labels, plus static checks), then an expert review that returns a score, issues and tips, then at most one auto-fix, accepted only if it measurably improves the result. Quick tweaks get the measurement only; first builds and re-audits also get the expert review. Tips (upload assets, decisions, details to add) appear under the result. Uploaded images are referenced as `asset:ID` tokens so image bytes never go into prompts.

Not yet ported to the Next.js app (`src/`): skill packs, the gate, tips and assets.

## UI standard

The artifact's own interface follows the head-designer constitution: three tones (jade, vermilion, paper) plus ink with everything else mixed from them, no gradients or pills, radii of 8px or less, one directional shadow on the mic, paper grain, a left-weighted hero, and rows and rules instead of bordered cards. Tap targets are 44px or more and text meets AA contrast.

## Output first, check in the background

A prototype is delivered the moment generation finishes. While it writes, a work log shows the steps (spec read, skills applied, a live phase detected from the stream, elapsed time). The check agent then runs in the background with live steps: measure, expert review, fix, verify. A fix is saved as a new version and offered with a "switch" button; the version on screen never changes underneath you, and the preview iframe is never reloaded by the check.
