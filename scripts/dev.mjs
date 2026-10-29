import { createServer as createHttpServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { createHandler } from "../src/server.mjs";
import { serveBrand } from "../src/static.mjs";
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Choose a valid PORT.");
const api = createHandler();
let vite;
const server = createHttpServer(async (req, res) => {
  if (new URL(req.url, "http://localhost").pathname.startsWith("/api/"))
    return api(req, res);
  if (await serveBrand(req, res)) return;
  vite.middlewares(req, res, () => {
    res.statusCode = 404;
    res.end("Not found.");
  });
});
vite = await createViteServer({
  server: { middlewareMode: true, ws: { server } },
  appType: "spa",
});
// Brand files have the same explicit allowlist as production; Vite owns source modules.
server.listen(port, "127.0.0.1", () =>
  console.log(`ExplainBack React studio: http://127.0.0.1:${port}`),
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await vite.close();
  server.close();
}
process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());
