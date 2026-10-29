import { build } from "vite";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { brandFiles, seoFiles } from "../src/static.mjs";
await build();
for (const [path] of brandFiles) {
  await mkdir(dirname(fileURLToPath(new URL("../dist" + path, import.meta.url))), {
    recursive: true,
  });
  await copyFile(
    new URL("../public" + path, import.meta.url),
    new URL("../dist" + path, import.meta.url),
  );
}
for (const [path, [, body]] of seoFiles)
  await writeFile(new URL("../dist" + path, import.meta.url), body);
console.log("Built React frontend, public brand assets, manifest, service worker and crawler files.");
