// Renders the SVG icons to PNG (PWA install + iOS splash/touch icon) with the preinstalled Playwright Chromium.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // preinstalled globally; not a project dependency
import { readFileSync } from "node:fs";
const out = new URL("../public/icons/", import.meta.url);
const jobs = [["icon.svg", "icon-192.png", 192], ["icon.svg", "icon-512.png", 512], ["maskable.svg", "maskable-512.png", 512], ["maskable.svg", "apple-touch-icon.png", 180]];
const b = await chromium.launch();
const p = await b.newPage();
for (const [src, dst, size] of jobs) {
  const svg = readFileSync(new URL(src, out), "utf8");
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await p.screenshot({ path: new URL(dst, out).pathname, omitBackground: true });
}
await b.close();
console.log("icons written");
