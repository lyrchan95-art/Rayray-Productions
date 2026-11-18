// Runs the zero-cost heuristic router against evals/router.json and prints accuracy + confusion.
// Usage: npm run eval:router   (exit 1 if accuracy < 90%)
import { readFileSync } from "node:fs";
import { heuristicRoute } from "../src/lib/skills/heuristics.ts";

type Item = { text: string; expected: string; artifactSkill?: string };
const { items } = JSON.parse(readFileSync(new URL("../evals/router.json", import.meta.url), "utf8")) as { items: Item[] };

let ok = 0;
const misses: string[] = [];
const confusion: Record<string, Record<string, number>> = {};
for (const it of items) {
  const r = heuristicRoute(it.text, { artifactSkill: (it.artifactSkill as never) ?? null });
  confusion[it.expected] ??= {};
  confusion[it.expected][r.skill] = (confusion[it.expected][r.skill] ?? 0) + 1;
  if (r.skill === it.expected) ok++;
  else misses.push(`  ✗ [${it.expected} → ${r.skill} @${r.confidence}] ${it.text}`);
}
const acc = ok / items.length;
console.log(`router accuracy: ${ok}/${items.length} = ${(acc * 100).toFixed(1)}%`);
console.table(confusion);
if (misses.length) console.log("misses:\n" + misses.join("\n"));
process.exit(acc >= 0.9 ? 0 : 1);
