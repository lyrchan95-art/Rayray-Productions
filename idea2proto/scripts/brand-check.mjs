// PRD 5.1: no third-party assistant brand assets, fonts or palette values in the shipped app,
// and no raw colours outside the token file. Exit 1 on any hit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SCAN = ["src", "public"];
const FORBIDDEN = [
  /\bclaude\b/i, /anthropic/i,
  /copernicus/i, /styrene/i, /tiempos/i,             // proprietary brand typefaces
  /#(d97757|c96442|cc785c|da7756|bd5d3a|f0eee6|faf9f5|f5f4ed|e3dacc|f4f3ee|141413|3d3929|5e5d59)\b/i, // cream / terracotta family
];
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
SCAN.forEach((d) => walk(path.join(ROOT, d)));

let bad = 0;
for (const f of files) {
  if (!/\.(tsx?|css|mjs|js|json|webmanifest|svg|html)$/.test(f)) continue;
  const rel = path.relative(ROOT, f);
  const src = readFileSync(f, "utf8");
  src.split("\n").forEach((line, i) => {
    for (const re of FORBIDDEN) if (re.test(line)) { bad++; console.log(`${rel}:${i + 1}  forbidden ${re}`); }
  });
  // raw colours only allowed in the token file, icons, manifest/meta theme colours and the sandboxed mock artifact templates
  if (rel.endsWith(".css") && !rel.endsWith("tokens.css") && /#[0-9a-f]{3,8}\b|rgba?\(/i.test(src)) {
    bad++; console.log(`${rel}: raw colour outside tokens.css`);
  }
}
console.log(bad ? `brand-check: ${bad} problem(s)` : `brand-check: clean (${files.length} files)`);
process.exit(bad ? 1 : 0);
