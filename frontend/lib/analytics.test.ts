import { describe, expect, test } from "vitest";
import {
  analyticsPath,
  analyticsRoute,
  startVercelAnalytics,
} from "./analytics";

function fakeWindow(hostname: string) {
  const listeners: Record<string, (() => void)[]> = {};
  const win = {
    location: { hostname, hash: "", pathname: "/" },
    document,
    addEventListener: (name: string, fn: () => void) => {
      (listeners[name] ??= []).push(fn);
    },
    va: undefined,
    vaq: undefined,
  } as unknown as Window;
  return { win, listeners };
}

describe("Vercel analytics", () => {
  test("stays off outside the hosted site", () => {
    expect(startVercelAnalytics(fakeWindow("localhost").win)).toBe(false);
    expect(startVercelAnalytics(fakeWindow("127.0.0.1").win)).toBe(false);
    expect(
      document.querySelector("script[data-explainback-analytics]"),
    ).toBeNull();
  });
  test("loads the same-origin script once and reports hash routes without invite codes", () => {
    const { win, listeners } = fakeWindow("explainback.app");
    expect(startVercelAnalytics(win)).toBe(true);
    expect(startVercelAnalytics(win)).toBe(true);
    const scripts = document.querySelectorAll(
      "script[data-explainback-analytics]",
    );
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("src")).toBe("/_vercel/insights/script.js");
    win.location.hash = "#invite:JUDGE-SECRET1";
    listeners.hashchange?.forEach((fn) => fn());
    expect(win.vaq).toEqual([
      ["pageview", { route: "/#invite:[id]", path: "/#invite" }],
    ]);
    scripts[0].remove();
  });
  test("route and path helpers", () => {
    expect(analyticsRoute("#lesson:cooling")).toBe("/#lesson:[id]");
    expect(analyticsRoute("#create")).toBe("/#create");
    expect(analyticsPath("#show:cooling")).toBe("/#show:cooling");
    expect(analyticsPath("")).toBe("/");
  });
});
