// Builds artifact/idea2proto-live.html from the .src.html template by inlining skills/*.md.
// Usage: node scripts/build-artifact.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const packs = readdirSync(new URL("skills/", root))
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .sort()
  .map((f) => {
    const raw = readFileSync(new URL(`skills/${f}`, root), "utf8");
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${f}: missing front matter`);
    const meta = Object.fromEntries(m[1].split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }));
    for (const k of ["id", "name", "zh", "kind", "applies", "default", "summary_zh", "summary_en"]) {
      if (!meta[k]) throw new Error(`${f}: front matter is missing "${k}"`);
    }
    return {
      id: meta.id, name: meta.name, zh: meta.zh, kind: meta.kind,
      applies: meta.applies.split(",").map((s) => s.trim()),
      on: meta.default !== "off", source: meta.source || "",
      summary: [meta.summary_zh, meta.summary_en], body: m[2].trim(),
    };
  });

const src = readFileSync(new URL("artifact/idea2proto-live.src.html", root), "utf8");
if (!src.includes("/*__PACKS__*/")) throw new Error("template has no /*__PACKS__*/ marker");
// Escape "</" so skill text can never close the surrounding <script> tag.
const json = JSON.stringify(packs).replace(/<\//g, "<\\/");
writeFileSync(new URL("artifact/idea2proto-live.html", root), src.replace("/*__PACKS__*/[]", json));
console.log(`built artifact with ${packs.length} skills: ${packs.map((p) => p.id).join(", ")}`);
