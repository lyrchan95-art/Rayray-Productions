# Skills

Each file is one skill: YAML-style front matter, then the prompt text that gets injected.

| kind | meaning |
|---|---|
| `craft` | Injected into generation prompts for the skills listed in `applies`. Users can switch each one on or off in the Skills tab. |
| `workflow` | A multi-step process around generation. `ux-audit` is the quality gate: measure, review, auto-fix once, then show tips. |

Add a skill: drop a new `.md` here, then rebuild the artifact (`node scripts/build-artifact.mjs`). The Skills tab picks it up.
