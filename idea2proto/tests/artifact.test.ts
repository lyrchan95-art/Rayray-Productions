import { test } from "node:test";
import assert from "node:assert/strict";
import { extractArtifact } from "../src/lib/artifact/extract.ts";
import { ARTIFACT_CSP, wrapArtifact } from "../src/lib/artifact/runtime.ts";

test("extracts fenced html and the prose note", () => {
  const r = extractArtifact("Here you go.\n\n```html\n<!doctype html><html><head></head><body>hi</body></html>\n```\nthanks");
  assert.equal(r.note, "Here you go.");
  assert.match(r.html!, /<body>hi<\/body>/);
});

test("extracts bare html without a fence", () => {
  const r = extractArtifact("Done!\n<!DOCTYPE html><html><body>x</body></html>");
  assert.equal(r.note, "Done!");
  assert.ok(r.html!.startsWith("<!DOCTYPE html>"));
});

test("repairs truncated output and adds a viewport", () => {
  const r = extractArtifact("```html\n<html><head></head><body><script>let a = 1;");
  assert.match(r.html!, /<\/script>\s*<\/body>\s*<\/html>$/);
  assert.match(r.html!, /name="viewport"/);
  assert.match(r.html!, /^<!doctype html>/);
});

test("plain chat reply has no artifact", () => {
  assert.equal(extractArtifact("Just some advice, no code.").html, null);
});

test("wrap injects CSP + shim before any artifact script", () => {
  const out = wrapArtifact("<!doctype html><html><head><script>window.x=1</script></head><body></body></html>");
  const csp = out.indexOf("Content-Security-Policy");
  const shim = out.indexOf("i2p-storage");
  const user = out.indexOf("window.x=1");
  assert.ok(csp > 0 && shim > csp && user > shim);
  assert.ok(out.includes(ARTIFACT_CSP));
  assert.ok(ARTIFACT_CSP.includes("connect-src 'none'"));
});

test("seed cannot break out of the script tag", () => {
  const out = wrapArtifact("<html><head></head></html>", { seed: { k: "</script><script>alert(1)</script>" } });
  assert.ok(!out.includes("</script><script>alert(1)"));
});
