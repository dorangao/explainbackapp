import { expect, test, vi } from "vitest";
import { registerServiceWorker } from "./install";

test("the service worker registers only on production builds that support it", () => {
  const register = vi.fn(() => Promise.resolve());
  const nav = { serviceWorker: { register } } as unknown as Navigator;
  expect(registerServiceWorker(nav, false)).toBe(false);
  expect(registerServiceWorker({} as Navigator, true)).toBe(false);
  expect(registerServiceWorker(nav, true)).toBe(true);
  expect(register).toHaveBeenCalledWith("/sw.js");
});
