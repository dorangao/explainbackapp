import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("installing the appearance shell preserves app assets fetched by the existing worker", async () => {
  // An existing installed app receives new hashed assets through its old worker
  // before the page registers the updated worker. Keep those assets for offline.
  const existing = new Map([["/assets/index-current.js", "app"], ["/assets/index-current.css", "styles"]]);
  const stores = new Map([["explainback-shell-v1", existing]]);
  const handlers = new Map();
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      return { async addAll(paths) { for (const path of paths) stores.get(name).set(path, "shell"); } };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, caches });
  for (const event of ["install", "activate"]) {
    let completion;
    handlers.get(event)({ waitUntil(value) { completion = value; } });
    await completion;
  }
  const entries = [...stores.values()];
  for (const path of ["/assets/index-current.js", "/assets/index-current.css", "/appearance.js?v=2", "/themes.css?v=2"])
    assert.ok(entries.some((cache) => cache.has(path)), `${path} must remain available offline after the update`);
});

test("versioned head assets bypass the previous appearance cached by an installed worker", async () => {
  const origin = "https://example.test";
  const existing = new Map([
    [`${origin}/appearance.js`, new Response("old runtime")],
    [`${origin}/themes.css`, new Response("old palette")],
  ]);
  const handlers = new Map();
  const requested = [];
  const caches = {
    async match(request) { return existing.get(request.url)?.clone(); },
    async open() { return { async put(request, response) { existing.set(request.url, response); } }; },
  };
  const self = {
    location: { origin },
    addEventListener: (name, handler) => handlers.set(name, handler),
  };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self, caches, URL, Response,
    fetch: async (request) => { requested.push(request.url); return new Response("current asset"); },
  });
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const paths = [...html.matchAll(/(?:src|href)="(\/(?:appearance\.js|themes\.css)[^"]*)"/g)].map((match) => match[1]);
  assert.equal(paths.length, 2);
  for (const path of paths) {
    const request = new Request(new URL(path, origin));
    let response;
    handlers.get("fetch")({ request, respondWith(value) { response = value; } });
    assert.equal(await (await response).text(), "current asset");
    assert.ok(requested.includes(request.url));
    assert.ok(existing.has(request.url), "the fresh asset remains available offline");
  }
});
