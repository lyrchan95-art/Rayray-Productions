/**
 * Artifact runtime: wraps a stored single-file HTML document for display.
 *  - strict CSP <meta> (no network, inline only, https images/fonts allowed)
 *  - storage shim: sandboxed iframes without allow-same-origin have an opaque origin, so
 *    localStorage throws (and iOS Safari is stricter still). The shim swaps in an in-memory
 *    Storage and mirrors writes to the parent via postMessage; the parent persists them and
 *    seeds them back on next load.
 * Pure string functions — safe for client and server.
 */

export const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src data: blob: https:",
  "media-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

export const SHIM_CHANNEL = "i2p-storage";

export function storageShim(seed: Record<string, string> = {}): string {
  return `<script>(function(){var CH=${JSON.stringify(SHIM_CHANNEL)};var seed=${JSON.stringify(seed).replace(/</g, "\\u003c")};
function mk(name,init){var d=Object.assign({},init);var api={getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},
setItem:function(k,v){d[String(k)]=String(v);sync(name,d)},removeItem:function(k){delete d[String(k)];sync(name,d)},clear:function(){d={};sync(name,d)},
key:function(i){return Object.keys(d)[i]||null}};Object.defineProperty(api,'length',{get:function(){return Object.keys(d).length}});return api}
function sync(name,d){if(name!=='localStorage')return;try{if(parent!==window)parent.postMessage({channel:CH,type:'set',data:d},'*')}catch(e){}}
function usable(s){try{var k='__t';window[s].setItem(k,'1');window[s].removeItem(k);return true}catch(e){return false}}
['localStorage','sessionStorage'].forEach(function(s){if(!usable(s)){try{Object.defineProperty(window,s,{configurable:true,value:mk(s,s==='localStorage'?seed:{})})}catch(e){}}});
})();</script>`;
}

export function wrapArtifact(html: string, opts: { seed?: Record<string, string> } = {}): string {
  const head = `<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_CSP}">${storageShim(opts.seed)}`;
  // Inject as early as possible so the shim runs before any artifact script.
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + head);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}
