// Classic, synchronous head script: the same preference implementation is also
// bundled as a fallback for React. Keep it independent of the application runtime.
(() => {
  if (window.explainbackAppearance) return;
  const options = Object.freeze([
    { id: "paper", en: "Paper", zh: "纸感", background: "#f6f5ef", scheme: "light" },
    { id: "midnight", en: "Midnight Paper", zh: "夜色纸感", background: "#14241f", scheme: "dark" },
    { id: "glass", en: "Liquid Glass", zh: "液态玻璃", background: "#f1f6f8", scheme: "light" },
    { id: "meta", en: "Meta Blue", zh: "Meta 蓝", background: "#f5f7fc", scheme: "light" },
  ].map(Object.freeze));
  const key = "explainback-appearance";
  function validate(value) {
    return Object.freeze({
      theme: options.some((option) => option.id === value?.theme) ? value.theme : "paper",
      reduceTransparency: value?.reduceTransparency === true,
    });
  }
  let preference = validate(null);
  try { preference = validate(JSON.parse(localStorage.getItem(key))); } catch {}
  function apply() {
    const option = options.find((item) => item.id === preference.theme);
    const root = document.documentElement;
    root.dataset.theme = preference.theme;
    root.dataset.reduceTransparency = String(preference.reduceTransparency);
    root.style.colorScheme = option.scheme;
    root.style.backgroundColor = option.background;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", option.background);
  }
  window.explainbackAppearance = Object.freeze({
    options,
    read: () => preference,
    select(value) {
      preference = validate(value);
      apply();
      try { localStorage.setItem(key, JSON.stringify(preference)); } catch {}
      return preference;
    },
  });
  apply();
})();
