import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../public/appearance.js", import.meta.url), "utf8");
function boot(saved, blocked = false) {
  const values = new Map(saved === undefined ? [] : [["explainback-appearance", saved]]);
  const root = { dataset: {}, style: {} };
  const meta = { setAttribute(name, value) { this[name] = value; } };
  const context = vm.createContext({
    document: { documentElement: root, querySelector: () => meta },
    localStorage: {
      getItem(key) { if (blocked) throw Error("blocked"); return values.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error("blocked"); values.set(key, value); },
    },
  });
  context.window = context;
  vm.runInContext(source, context);
  return { api: context.explainbackAppearance, root, meta, values, context };
}

test("first paint defaults to Paper without a preference", () => {
  const { api, root, meta } = boot();
  assert.equal(api.read().theme, "paper");
  assert.equal(root.dataset.theme, "paper");
  assert.equal(root.style.colorScheme, "light");
  assert.equal(meta.content, "#f6f5ef");
});

test("a saved dark preference applies before React, including reduced transparency", () => {
  const { api, root, meta, context } = boot(JSON.stringify({ theme: "midnight", reduceTransparency: true }));
  assert.equal(root.dataset.theme, "midnight");
  assert.equal(root.dataset.reduceTransparency, "true");
  assert.equal(root.style.colorScheme, "dark");
  assert.equal(meta.content, "#14241f");
  api.select({ theme: "meta", reduceTransparency: true });
  vm.runInContext(source, context); // bundled fallback must not reset the live preference
  assert.equal(api.read().theme, "meta");
});

test("invalid or malformed preferences safely fall back to Paper", () => {
  for (const value of ["bad json", "null", "[]", '"midnight"', '{"theme":"unknown"}', '{"theme":"__proto__"}']) {
    assert.equal(boot(value).root.dataset.theme, "paper");
  }
  assert.equal(boot('{"theme":"glass","reduceTransparency":"false"}').api.read().reduceTransparency, false);
});

test("selection persists only a validated preference and updates browser chrome", () => {
  const { api, root, meta, values } = boot();
  api.select({ theme: "glass", reduceTransparency: true });
  assert.deepEqual(JSON.parse(values.get("explainback-appearance")), { theme: "glass", reduceTransparency: true });
  assert.equal(root.dataset.theme, "glass");
  assert.equal(meta.content, "#f1f6f8");
  api.select({ theme: "unknown", reduceTransparency: false });
  assert.equal(root.dataset.theme, "paper");
});

test("blocked storage does not prevent choosing a theme in the current tab", () => {
  const { api, root } = boot(undefined, true);
  assert.equal(root.dataset.theme, "paper");
  assert.doesNotThrow(() => api.select({ theme: "midnight", reduceTransparency: false }));
  assert.equal(api.read().theme, "midnight");
  assert.equal(root.dataset.theme, "midnight");
});
