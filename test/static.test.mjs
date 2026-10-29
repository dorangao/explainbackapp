import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.mjs";

// Catches missing icons, incorrect content types and accidental repository exposure.
test("public brand assets are served without authentication with their real content types", async (t) => {
  const server = createApp();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [path, type] of [
    ["/favicon.svg", "image/svg+xml"],
    ["/favicon.ico", "image/x-icon"],
    ["/apple-touch-icon.png", "image/png"],
    ["/brand/share.png", "image/png"],
    ["/manifest.webmanifest", "application/manifest+json"],
    ["/sw.js", "text/javascript"],
    ["/icons/icon-192.png", "image/png"],
    ["/icons/icon-512.png", "image/png"],
    ["/icons/maskable-512.png", "image/png"],
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get("content-type").startsWith(type));
    assert.ok((await response.arrayBuffer()).byteLength > 50);
  }
  for (const path of [
    "/package.json",
    "/.env.local",
    "/assets/missing.js",
    "/brand/../package.json",
    "/assets/%2e%2e%2fpackage.json",
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 404, path);
  }
});

// The site is public and indexable; crawler files come from the server, not the repository.
test("robots.txt allows crawling, excludes the API and names the sitemap", async (t) => {
  const server = createApp();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const robots = await fetch(origin + "/robots.txt");
  assert.equal(robots.status, 200);
  assert.ok(robots.headers.get("content-type").startsWith("text/plain"));
  const text = await robots.text();
  assert.match(text, /^Allow: \/$/m);
  assert.match(text, /^Disallow: \/api\/$/m);
  assert.match(text, /^Sitemap: https:\/\/explainback\.app\/sitemap\.xml$/m);
  const sitemap = await fetch(origin + "/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.ok(sitemap.headers.get("content-type").startsWith("application/xml"));
  assert.match(await sitemap.text(), /<loc>https:\/\/explainback\.app\/<\/loc>/);
  for (const [path, header] of [
    ["/robots.txt", "X-Robots-Tag"],
    ["/", "X-Robots-Tag"],
  ])
    assert.equal((await fetch(origin + path)).headers.get(header), null, path);
});

// Installability: the manifest names real icons and the worker never touches the API.
test("the web app manifest and service worker are consistent", async () => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(
    await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  const sizes = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`);
  assert.deepEqual(sizes, ["192x192:any", "512x512:any", "512x512:maskable"]);
  for (const icon of manifest.icons)
    assert.ok(
      (await readFile(new URL("../public" + icon.src, import.meta.url))).byteLength > 500,
      icon.src,
    );
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /startsWith\("\/api\/"\)/);
  assert.match(worker, /request\.method !== "GET"/);
});
