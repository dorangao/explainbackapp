// Deterministic local browser fixture: no environment files, provider credentials or paid calls.
import { createApp } from "../src/server.mjs";
import {
  coolingLesson,
  processLesson,
} from "../test-support/generated-lessons.mjs";
const fixtureBytes = Buffer.alloc(32);
fixtureBytes.write("RIFF", 0, "latin1");
fixtureBytes.write("WEBP", 8, "latin1");
const FIXTURE_IMAGE = `data:image/webp;base64,${fixtureBytes.toString("base64")}`;
const server = createApp({
  testerCredentials: {
    username: "browser-tester",
    password: "synthetic-browser-password",
  },
  configured: true,
  traceEnabled: true,
  openAccess: false,
  accessCodes: {
    codes: [
      {
        code: "BROWSER-TEST-CODE",
        label: "browser fixture",
        quota: 40,
        expiresAt: Date.now() + 86400000,
      },
    ],
    warnings: [],
  },
  // A fixture image model (a tiny WebP) and a fixture store that hands images back as
  // data URLs: no bytes leave the machine, yet saving keeps covers like Blob would.
  imageCall: async () => ({
    dataUrl: FIXTURE_IMAGE,
    model: "muse-image-1.0",
    usage: null,
  }),
  imageStore: {
    configured: true,
    owns: (url) => typeof url === "string" && url.startsWith("data:image/"),
    putImage: async ({ bytes, contentType }) =>
      `data:${contentType};base64,${bytes.toString("base64")}`,
    remove: async () => 0,
  },
  modelCall: async (args) => {
    const name = args.tools?.[0]?.name;
    const input = JSON.parse(args.input);
    if (name === "compose_lesson")
      return {
        toolCall: {
          name,
          arguments: JSON.stringify({
            status: "ready",
            message: { en: "Fixture draft ready.", zh: "示例草稿已就绪。" },
            lesson: input.topic?.toLowerCase().includes("web")
              ? processLesson()
              : coolingLesson(),
          }),
        },
      };
    if (name === "make_show") {
      const bi = (en, zh) => ({ en, zh });
      const slide = (kind, heading, narration) => ({
        kind,
        chapter: 0,
        heading: bi(heading, heading + "（中）"),
        narration: bi(narration, narration + "（中）"),
      });
      return {
        structured: {
          name,
          value: {
            slides: [
              slide("cover", "Hook", "Why does coffee cool the way it does?"),
              slide("claim", "Claim", "Is the cooling rate constant?"),
              slide("experiment", "Watch", "Watch the curve as the gap closes."),
              slide("takeaway", "Takeaway", "The gap drives the rate."),
            ],
            coverPrompt: "A cup of coffee by a window",
          },
        },
      };
    }
    return {
      toolCall: {
        name,
        arguments: JSON.stringify({
          explanation:
            "The values follow the reviewed model. Its assumptions need review.",
          nextAction: "replay",
        }),
      },
    };
  },
});
server.listen(4187, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());
