#!/usr/bin/env node
// Publish to Instagram via the Instagram Graph API (Business/Creator accounts only).
//
// Usage:
//   node instagram/post.js --image https://.../photo.jpg --caption "Hello"
//   node instagram/post.js --image URL1 --image URL2 --caption "Carousel"
//   node instagram/post.js --video https://.../clip.mp4 --caption "Reel"
//   node instagram/post.js --check        # verify token + account, posts nothing
//   add --dry-run to print the requests without sending them
//
// Media must be at a PUBLIC https URL (Instagram fetches it). Files committed to
// this repo are served by GitHub Pages, e.g.
//   https://lyrchan95-art.github.io/Rayray-Productions/<path>
//
// Config (env vars, or an instagram/.env file which is git-ignored):
//   IG_ACCESS_TOKEN   long-lived token (required)
//   IG_USER_ID        Instagram account id (optional with graph.instagram.com: "me" is used)
//   IG_GRAPH_HOST     graph.instagram.com (Instagram Login, default)
//                     or graph.facebook.com (Facebook Login / Page-linked account)
//   IG_API_VERSION    default v23.0

const path = require("path");

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  /* no .env file: rely on the environment */
}

function parseArgs(argv) {
  const opts = { images: [], video: null, caption: "", dryRun: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--image") opts.images.push(next());
    else if (a === "--video") opts.video = next();
    else if (a === "--caption") opts.caption = next();
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--check") opts.check = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!opts.check) {
    if (!opts.video && opts.images.length === 0) throw new Error("Give --image URL or --video URL");
    if (opts.video && opts.images.length) throw new Error("Use --video or --image, not both");
    if (opts.images.length > 10) throw new Error("A carousel holds at most 10 images");
    for (const u of [...opts.images, opts.video].filter(Boolean)) {
      if (!/^https:\/\//.test(u)) throw new Error(`Media must be a public https URL: ${u}`);
    }
  }
  return opts;
}

const HOST = process.env.IG_GRAPH_HOST || "graph.instagram.com";
const VERSION = process.env.IG_API_VERSION || "v23.0";
const TOKEN = process.env.IG_ACCESS_TOKEN;
const USER_ID = process.env.IG_USER_ID || (HOST === "graph.instagram.com" ? "me" : null);

let DRY_RUN = false;
let fakeId = 0;

async function graph(method, endpoint, params = {}) {
  const url = new URL(`https://${HOST}/${VERSION}/${endpoint}`);
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  if (DRY_RUN) {
    const shown = { ...params };
    console.log(`[dry-run] ${method} ${url.pathname}`, shown);
    return { id: `dry-${++fakeId}`, status_code: "FINISHED", username: "(dry-run)" };
  }
  let res;
  if (method === "GET") {
    for (const [k, v] of body) url.searchParams.set(k, v);
    res = await fetch(url);
  } else {
    res = await fetch(url, { method, body });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`Graph API ${res.status} on ${endpoint}: ${e.message || JSON.stringify(json)}`);
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntilReady(containerId) {
  for (let i = 0; i < 60; i++) {
    const { status_code } = await graph("GET", containerId, { fields: "status_code" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Media container ${containerId} failed: ${status_code}`);
    }
    await sleep(5000);
  }
  throw new Error(`Timed out waiting for container ${containerId}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  DRY_RUN = opts.dryRun;
  if (!TOKEN && !DRY_RUN) throw new Error("Set IG_ACCESS_TOKEN (see instagram/README.md)");
  if (!USER_ID) throw new Error("Set IG_USER_ID (required with graph.facebook.com)");

  const me = await graph("GET", USER_ID, { fields: "id,username" });
  console.log(`Account: @${me.username} (${me.id})`);
  if (opts.check) return;

  let creationId;
  if (opts.video) {
    const c = await graph("POST", `${USER_ID}/media`, {
      media_type: "REELS",
      video_url: opts.video,
      caption: opts.caption,
    });
    console.log("Uploading reel, waiting for Instagram to process it...");
    await waitUntilReady(c.id);
    creationId = c.id;
  } else if (opts.images.length === 1) {
    const c = await graph("POST", `${USER_ID}/media`, {
      image_url: opts.images[0],
      caption: opts.caption,
    });
    await waitUntilReady(c.id);
    creationId = c.id;
  } else {
    const children = [];
    for (const img of opts.images) {
      const c = await graph("POST", `${USER_ID}/media`, { image_url: img, is_carousel_item: "true" });
      await waitUntilReady(c.id);
      children.push(c.id);
    }
    const c = await graph("POST", `${USER_ID}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption: opts.caption,
    });
    await waitUntilReady(c.id);
    creationId = c.id;
  }

  const published = await graph("POST", `${USER_ID}/media_publish`, { creation_id: creationId });
  const info = await graph("GET", published.id, { fields: "permalink" }).catch(() => ({}));
  console.log(`Published! Media id ${published.id}${info.permalink ? `\n${info.permalink}` : ""}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
