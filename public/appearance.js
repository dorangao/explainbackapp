// Classic, synchronous head script: the same preference implementation is also
// bundled as a fallback for React. Keep it independent of the application runtime.
(() => {
  if (window.explainbackAppearance?.version === 2) return;
  const options = Object.freeze([
    { id: "paper", en: "Paper", zh: "纸感", light: "#f6f5ef", dark: "#14241f" },
    { id: "glass", en: "Liquid Glass", zh: "液态玻璃", light: "#f1f6f8", dark: "#10232c" },
    { id: "meta", en: "Meta Blue", zh: "Meta 蓝", light: "#f5f7fc", dark: "#141f30" },
  ].map(Object.freeze));
  const key = "explainback-appearance";
  function validate(value) {
    const known = options.some((option) => option.id === value?.theme);
    // Preserve explicit choices made before modes existed, including Midnight Paper.
    const legacy = (known || value?.theme === "midnight") && value.mode === undefined;
    return Object.freeze({
      theme: known ? value.theme : "paper",
      mode: legacy ? (value.theme === "midnight" ? "dark" : "light")
        : ["system", "light", "dark"].includes(value?.mode) ? value.mode : "system",
      reduceTransparency: value?.reduceTransparency === true,
    });
  }
  const parse = (raw) => { try { return validate(JSON.parse(raw)); } catch { return validate(null); } };
  let preference = validate(null);
  try { preference = parse(localStorage.getItem(key)); } catch {}
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const listeners = new Set();
  let snapshot;
  function apply() {
    const scheme = preference.mode === "system" ? (media?.matches ? "dark" : "light") : preference.mode;
    if (snapshot && snapshot.theme === preference.theme && snapshot.mode === preference.mode &&
      snapshot.reduceTransparency === preference.reduceTransparency && snapshot.scheme === scheme) return;
    snapshot = Object.freeze({ ...preference, scheme });
    const option = options.find((item) => item.id === preference.theme);
    const root = document.documentElement;
    root.dataset.theme = preference.theme;
    root.dataset.appearanceMode = preference.mode;
    root.dataset.colorScheme = scheme;
    root.dataset.reduceTransparency = String(preference.reduceTransparency);
    root.style.colorScheme = scheme;
    root.style.backgroundColor = option[scheme];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", option[scheme]);
    for (const listener of listeners) listener();
  }
  window.explainbackAppearance = Object.freeze({
    version: 2,
    options,
    read: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    select(value) {
      preference = validate(value);
      apply();
      try { localStorage.setItem(key, JSON.stringify(preference)); } catch {}
      return snapshot;
    },
  });
  media?.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    try { if (event.storageArea && event.storageArea !== localStorage) return; } catch {}
    preference = parse(event.newValue);
    apply();
  });
  apply();
})();
