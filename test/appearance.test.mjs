import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../public/appearance.js", import.meta.url), "utf8");
function boot(saved, { blocked = false, dark = false } = {}) {
  const values = new Map(saved === undefined ? [] : [["explainback-appearance", saved]]);
  const root = { dataset: {}, style: {} };
  const meta = { setAttribute(name, value) { this[name] = value; } };
  const events = new Map(), changes = new Set();
  const media = { matches: dark, addEventListener(name, listener) { if (name === "change") changes.add(listener); } };
  const storage = {
    getItem(key) { if (blocked) throw Error("blocked"); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error("blocked"); values.set(key, value); },
  };
  const context = vm.createContext({
    document: { documentElement: root, querySelector: () => meta }, localStorage: storage,
    matchMedia: () => media, addEventListener(name, listener) { events.set(name, listener); },
  });
  context.window = context;
  vm.runInContext(source, context);
  return {
    api: context.explainbackAppearance, root, meta, values, context,
    system(dark) { media.matches = dark; for (const listener of changes) listener({ matches: dark }); },
    storage(value, key = "explainback-appearance", area = storage) { events.get("storage")?.({ key, newValue: value, storageArea: area }); },
  };
}

test("new visitors follow their device before React starts", () => {
  for (const dark of [false, true]) {
    const { api, root, meta } = boot(undefined, { dark });
    assert.equal(api.read().mode, "system");
    assert.equal(root.dataset.theme, "paper");
    assert.equal(root.dataset.colorScheme, dark ? "dark" : "light");
    assert.equal(root.style.colorScheme, dark ? "dark" : "light");
    assert.equal(meta.content, dark ? "#14241f" : "#f6f5ef");
  }
});

test("legacy selections retain their appearance even on an opposite device scheme", () => {
  for (const [legacy, theme, mode] of [["midnight", "paper", "dark"], ["paper", "paper", "light"], ["glass", "glass", "light"], ["meta", "meta", "light"]]) {
    const { api, root } = boot(JSON.stringify({ theme: legacy, reduceTransparency: true }), { dark: mode === "light" });
    assert.equal(api.read().theme, theme);
    assert.equal(api.read().mode, mode);
    assert.equal(root.style.colorScheme, mode);
    assert.equal(root.dataset.reduceTransparency, "true");
  }
});

test("system changes update subscribers while manual mode remains independent of the device", () => {
  const { api, root, system } = boot();
  let changes = 0;
  const unsubscribe = api.subscribe(() => changes++);
  const initial = api.read();
  assert.equal(api.read(), initial, "snapshots stay stable until their values change");
  system(true);
  assert.equal(api.read().scheme, "dark");
  assert.notEqual(api.read(), initial);
  assert.equal(changes, 1);
  api.select({ theme: "glass", mode: "light", reduceTransparency: false });
  system(false); system(true);
  assert.equal(root.dataset.theme, "glass");
  assert.equal(root.style.colorScheme, "light");
  assert.equal(changes, 2, "irrelevant OS changes do not invalidate the UI snapshot");
  api.select({ ...api.read(), mode: "system" });
  assert.equal(root.style.colorScheme, "dark");
  unsubscribe(); system(false);
  assert.equal(changes, 3);
});

test("persisted preferences exclude derived state and apply the matching dark browser chrome", () => {
  const { api, root, meta, values, context } = boot();
  api.select({ theme: "glass", mode: "dark", reduceTransparency: true, unrelated: "ignored" });
  assert.deepEqual(JSON.parse(values.get("explainback-appearance")), { theme: "glass", mode: "dark", reduceTransparency: true });
  assert.equal(root.style.backgroundColor, "#10232c");
  assert.equal(meta.content, "#10232c");
  vm.runInContext(source, context);
  assert.equal(context.explainbackAppearance, api);
  assert.equal(api.read().scheme, "dark");
});

test("another tab's selection and removal update the current tab without writing back", () => {
  const { api, root, values, storage } = boot(undefined, { dark: true });
  storage(JSON.stringify({ theme: "meta", mode: "light", reduceTransparency: false }));
  assert.equal(api.read().theme, "meta");
  assert.equal(root.style.colorScheme, "light");
  assert.equal(values.size, 0);
  storage(null);
  assert.equal(api.read().mode, "system");
  assert.equal(root.style.colorScheme, "dark");
  storage(JSON.stringify({ theme: "glass", mode: "light" }), "another-key");
  storage(JSON.stringify({ theme: "glass", mode: "light" }), "explainback-appearance", {});
  assert.equal(root.dataset.theme, "paper");
  api.select({ theme: "meta", mode: "light", reduceTransparency: false });
  storage(null, null);
  assert.equal(api.read().mode, "system");
});

test("malformed preferences and blocked storage still allow system and manual modes", () => {
  for (const saved of ["bad json", "null", "[]", '"midnight"', '{"theme":"unknown"}', '{"theme":"__proto__"}']) {
    const { api, root } = boot(saved, { dark: true });
    assert.equal(root.dataset.theme, "paper");
    assert.equal(api.read().mode, "system");
    assert.equal(root.style.colorScheme, "dark");
  }
  const { api, root } = boot(undefined, { blocked: true, dark: true });
  assert.doesNotThrow(() => api.select({ theme: "meta", mode: "light", reduceTransparency: false }));
  assert.equal(root.style.colorScheme, "light");
  assert.equal(api.read().theme, "meta");
});
