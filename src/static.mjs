import { readFile } from "node:fs/promises";
export const brandFiles = new Map([
  ["/favicon.svg", "image/svg+xml"],
  ["/favicon.ico", "image/x-icon"],
  ["/apple-touch-icon.png", "image/png"],
  ["/brand/mark.svg", "image/svg+xml"],
  ["/brand/share.png", "image/png"],
  ["/manifest.webmanifest", "application/manifest+json"],
  ["/sw.js", "text/javascript; charset=utf-8"],
  ["/icons/icon-192.png", "image/png"],
  ["/icons/icon-512.png", "image/png"],
  ["/icons/maskable-512.png", "image/png"],
  ["/gallery/pendulum-sketch.png", "image/png"],
  ...["cooling","pendulum","web-cache","vehicle","quantum","sketch-pendulum"].map(
    (id) => [`/gallery/${id}-cover.webp`, "image/webp"],
  ),
]);
// Crawler files are generated, not stored: the build writes them into dist and the
// local server answers them from here. Hash routes are one page, so the sitemap has one URL.
export const siteOrigin = "https://explainback.app";
export const seoFiles = new Map([
  [
    "/robots.txt",
    ["text/plain; charset=utf-8", `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${siteOrigin}/sitemap.xml\n`],
  ],
  [
    "/sitemap.xml",
    [
      "application/xml; charset=utf-8",
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteOrigin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`,
    ],
  ],
]);
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function serveBrand(req, res, extraHeaders = {}) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const path = new URL(req.url, "http://localhost").pathname,
    type = brandFiles.get(path);
  if (!type) return false;
  try {
    const data = await readFile(new URL("../public" + path, import.meta.url));
    res.writeHead(200, { ...headers, ...extraHeaders, "Content-Type": type });
    res.end(req.method === "HEAD" ? undefined : data);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
export async function serveFrontend(req, res, extraHeaders = {}) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (await serveBrand(req, res, extraHeaders)) return true;
  const path = new URL(req.url, "http://localhost").pathname;
  const seo = seoFiles.get(path);
  if (seo) {
    res.writeHead(200, { ...headers, ...extraHeaders, "Content-Type": seo[0] });
    res.end(req.method === "HEAD" ? undefined : seo[1]);
    return true;
  }
  // One flat generated assets directory. No encoded separators, dot segments, maps or arbitrary repository paths.
  const asset = /^\/assets\/[a-zA-Z0-9_-]+\.(js|css|woff2|png|svg)$/.exec(path);
  if (
    path !== "/" &&
    path !== "/index.html" &&
    !asset
  )
    return false;
  const type = asset
    ? {
        js: "text/javascript; charset=utf-8",
        css: "text/css; charset=utf-8",
        woff2: "font/woff2",
        png: "image/png",
        svg: "image/svg+xml",
      }[asset[1]]
    : "text/html; charset=utf-8";
  try {
    const data = await readFile(
      new URL(
        "../dist" + (path === "/" ? "/index.html" : path),
        import.meta.url,
      ),
    );
    res.writeHead(200, { ...headers, ...extraHeaders, "Content-Type": type });
    res.end(req.method === "HEAD" ? undefined : data);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
