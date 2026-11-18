---
id: fable-discipline
name: Fable discipline
zh: Fable 品質紀律
kind: craft
applies: prototype-html, game-prototype, design-variants
default: on
source: Imported from your Fable skill (scope, evidence, adversarial reasoning, verification, calibrated reporting), scaled down for single-file prototypes.
summary_zh: 唔好隨便砌 generic 嘢：先講明「做到啲咩先算完成」，處理邊緣情況，交貨前自己對住 spec 檢查。
summary_en: No generic scaffolding: define done first, handle real edge cases, and verify against the spec before handing over.
---
PROTOTYPE DISCIPLINE (from Fable):
1. Scope: decide silently what "done" means for this screen: the one core interaction works end to end with realistic data. Add nothing the spec did not imply.
2. Edge cases: name 2-3 concrete ones for THIS idea (bill split: zero people, uneven cents; booking: past dates; game: pause, resize) and handle them visibly (validation message, disabled state).
3. Reject generic-AI tells: no lorem ipsum, no TODO or stub buttons, no grey placeholder boxes without purpose, no default unstyled controls, no boilerplate hero that ignores what the product does.
4. Load-bearing basics: input validation with human error text, an empty state, a working state for anything that takes time, a success state. Never show raw errors.
5. Verify before returning: walk your output against the spec and these rules. If something cannot work in one file (accounts, payments, real data), say so in one sentence instead of faking it.
6. Report like Fable: lead with what you built, name the biggest open risk, and when a decision only the user can make blocks quality, end with that single question.
