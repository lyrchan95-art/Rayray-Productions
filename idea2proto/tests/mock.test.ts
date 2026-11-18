import { test } from "node:test";
import assert from "node:assert/strict";
import { MockProvider } from "../src/lib/models/mock.ts";
import { SKILLS } from "../src/lib/skills/registry.ts";
import { extractArtifact } from "../src/lib/artifact/extract.ts";

const spec = { title: "Egg Tart Catch", oneLiner: "Catch tarts", coreInteraction: "drag", targetUser: "anyone", suggestedSkill: "game-prototype" as const };
const p = new MockProvider();

for (const id of ["prototype-html", "game-prototype", "design-variants"] as const) {
  test(`mock ${id} produces a single-file artifact through the real prompt`, async () => {
    const messages = SKILLS[id].build({ register: "en", spec, history: [], input: "build it" });
    const out = await p.complete({ model: "mock", task: "code", messages });
    const { html } = extractArtifact(out);
    assert.ok(html, "has html");
    assert.ok(!/<script\s+src=/i.test(html!), "no external scripts");
    if (id === "game-prototype") assert.match(html!, /<canvas/);
    if (id === "design-variants") assert.match(html!, /scroll-snap/);
  });
}

test("mock structure returns a valid spec", async () => {
  const messages = SKILLS["idea-capture"].build({ register: "yue", history: [], input: "整個小遊戲，接住蛋撻" });
  const spec = JSON.parse(await p.complete({ model: "mock", task: "structure", messages }));
  assert.equal(spec.suggestedSkill, "game-prototype");
  assert.ok(spec.title);
});
