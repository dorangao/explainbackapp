// Vercel Web Analytics, loaded only on the hosted site (same-origin script, so the
// CSP stays `script-src 'self'`). Hash routes are reported as page views with any
// invite code removed; the model requests themselves are never sent.
type Va = (event: string, data?: Record<string, unknown>) => void;
declare global {
  interface Window {
    va?: Va;
    vaq?: unknown[][];
  }
}
const hostedSite = /(^|\.)explainback\.app$|\.vercel\.app$/;
export function analyticsRoute(hash: string): string {
  const typed = /^#(lesson|show|invite):/.exec(hash);
  return "/" + (typed ? `#${typed[1]}:[id]` : hash);
}
export function analyticsPath(hash: string, pathname = "/"): string {
  return pathname + hash.replace(/^#invite:.*$/, "#invite");
}
export function startVercelAnalytics(win: Window = window): boolean {
  if (!hostedSite.test(win.location.hostname)) return false;
  const doc = win.document;
  if (doc.querySelector("script[data-explainback-analytics]")) return true;
  win.va ??= (...args) => {
    (win.vaq ??= []).push(args);
  };
  const script = doc.createElement("script");
  script.defer = true;
  script.src = "/_vercel/insights/script.js";
  script.dataset.explainbackAnalytics = "1";
  doc.head.append(script);
  win.addEventListener("hashchange", () => {
    win.va?.("pageview", {
      route: analyticsRoute(win.location.hash),
      path: analyticsPath(win.location.hash, win.location.pathname),
    });
  });
  return true;
}
