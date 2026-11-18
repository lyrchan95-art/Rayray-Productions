import { test } from "node:test";
import assert from "node:assert/strict";
import { heuristicRoute, CONFIDENCE_THRESHOLD } from "../src/lib/skills/heuristics.ts";

test("routes games, variants, pages, chat", () => {
  assert.equal(heuristicRoute("整個小遊戲，接住菠蘿包").skill, "game-prototype");
  assert.equal(heuristicRoute("show me 3 different styles for my cafe").skill, "design-variants");
  assert.equal(heuristicRoute("幫我整個網頁介紹我嘅烘焙班").skill, "prototype-html");
  assert.equal(heuristicRoute("點樣定價先合理？").skill, "chat");
});

test("tweaks follow the open artifact's skill", () => {
  assert.equal(heuristicRoute("大啲", { artifactSkill: "game-prototype" }).skill, "game-prototype");
  assert.equal(heuristicRoute("bigger buttons", { artifactSkill: "prototype-html" }).skill, "prototype-html");
});

test("low confidence falls back to chat", () => {
  const r = heuristicRoute("hmm");
  assert.equal(r.skill, "chat");
  assert.ok(r.confidence < CONFIDENCE_THRESHOLD);
});
