// Deterministic raster exports of the source-designed ExplainBack mark.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const mark = await readFile(
    new URL("../public/brand/mark.svg", import.meta.url),
    "utf8",
  );
  async function icon(size) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0}svg{display:block;width:100%;height:100%}</style>${mark}`,
    );
    return page.screenshot({ omitBackground: true });
  }
  await writeFile(
    new URL("../public/apple-touch-icon.png", import.meta.url),
    await icon(180),
  );
  const entries = [16, 32, 48].map((size) => ({ size, png: null }));
  // Render sequentially: the viewport belongs to this one page.
  for (const entry of entries) entry.png = await icon(entry.size);
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, png }, i) => {
    const p = 6 + i * 16;
    header[p] = size;
    header[p + 1] = size;
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(png.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += png.length;
  });
  await writeFile(
    new URL("../public/favicon.ico", import.meta.url),
    Buffer.concat([header, ...entries.map((e) => e.png)]),
  );
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(
    `<style>*{box-sizing:border-box}body{margin:0;background:#f5f3ea;color:#173c31;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;padding:56px 72px}.brand{display:flex;align-items:center;gap:16px;font-size:29px;font-weight:650}.brand svg{width:56px;height:56px}h1{font-size:66px;line-height:1.12;letter-spacing:-2.2px;font-weight:550;margin:69px 0 22px}em{font-family:Georgia,serif;font-weight:400}p{font-size:22px;line-height:1.5;color:#52665c;margin:0}.foot{position:absolute;bottom:44px;left:72px;right:72px;border-top:1px solid #ced6ca;padding-top:20px;display:flex;justify-content:space-between;font-size:16px;letter-spacing:1px}.echo{position:absolute;right:64px;top:170px;font:230px Georgia;color:#dbe5d6;z-index:-1}</style><div class="brand">${mark} ExplainBack</div><h1>A question. An experiment.<br/><em>Your own explanation.</em></h1><p>Explore an idea, see what changes, and explain it back.</p><div class="foot"><span>INTERACTIVE LEARNING · EN / 中文</span><span>explainback.app</span></div>`,
  );
  await writeFile(
    new URL("../public/brand/share.png", import.meta.url),
    await page.screenshot(),
  );
} finally {
  await browser.close();
}
