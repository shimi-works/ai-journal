import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  html: new URL("../index.html", import.meta.url),
  manifest: new URL("../manifest.webmanifest", import.meta.url),
  serviceWorker: new URL("../sw.js", import.meta.url),
};

const [html, manifestText, serviceWorker] = await Promise.all([
  readFile(files.html, "utf8"),
  readFile(files.manifest, "utf8"),
  readFile(files.serviceWorker, "utf8"),
]);

const manifest = JSON.parse(manifestText);
assert.equal(manifest.name, "AI Journal");
assert.equal(manifest.display, "standalone");
assert.match(html, /<meta\s+name="viewport"/i);
assert.match(html, /<link\s+rel="manifest"\s+href="\.\/manifest\.webmanifest"/i);
assert.match(html, /navigator\.serviceWorker\.register/);
assert.match(serviceWorker, /addEventListener\(["']fetch["']/);

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim());

assert.ok(inlineScripts.length > 0, "index.html must contain an inline application script");
for (const script of inlineScripts) {
  new Function(script);
}

assert.doesNotMatch(html, /AIza[0-9A-Za-z_-]{30,}/, "Google API key-like value found");
assert.doesNotMatch(html, /VAPID_PRIVATE_KEY\s*[=:]\s*["'][^"']+/i, "VAPID private key found");

console.log(`Smoke checks passed: ${inlineScripts.length} inline script block(s) parsed.`);
