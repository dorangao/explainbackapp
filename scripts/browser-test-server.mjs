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
// Failure and absence modes for the error-state walk, chosen by environment:
//   FIXTURE_NO_IMAGES=1   no image model (covers, illustrations and the judge step unavailable)
//   FIXTURE_NO_DETECT=1   no SAM 3.1
//   FIXTURE_NO_STORE=1    no Blob storage (images dropped on save, with the notice)
//   FIXTURE_QUOTA=n       hourly budget of the fixture code (default 40)
//   FIXTURE_FAIL=show|compose|tryout|illustrate   that model call throws
//   FIXTURE_SLOW_COVER=1  the cover is skipped for time
const mode = {
  noImages: process.env.FIXTURE_NO_IMAGES === "1",
  noDetect: process.env.FIXTURE_NO_DETECT === "1",
  noStore: process.env.FIXTURE_NO_STORE === "1",
  quota: Number(process.env.FIXTURE_QUOTA || 40),
  fail: process.env.FIXTURE_FAIL || "",
  slowCover: process.env.FIXTURE_SLOW_COVER === "1",
};
const failing = (tool) =>
  (mode.fail === "compose" && tool === "compose_lesson") ||
  (mode.fail === "tryout" && tool === "try_lesson") ||
  (mode.fail === "show" && tool === "make_show");
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
        quota: mode.quota,
        expiresAt: Date.now() + 86400000,
      },
    ],
    warnings: [],
  },
  // A fixture image model (a tiny WebP) and a fixture store that hands images back as
  // data URLs: no bytes leave the machine, yet saving keeps covers like Blob would.
  imageCall: mode.noImages
    ? null
    : async ({ timeoutMs }) => {
        if (mode.fail === "illustrate") throw new Error("fixture failure");
        if (mode.slowCover && timeoutMs < 60_000)
          throw new Error("fixture: cover skipped");
        return { dataUrl: FIXTURE_IMAGE, model: "muse-image-1.0", usage: null };
      },
  imageStore: mode.noStore ? null : {
    configured: true,
    owns: (url) => typeof url === "string" && url.startsWith("data:image/"),
    putImage: async ({ bytes, contentType }) =>
      `data:${contentType};base64,${bytes.toString("base64")}`,
    remove: async () => 0,
  },
  // A fixture SAM 3.1: one box for anything named, none for "nothing".
  segmentCall: mode.noDetect ? null : async ({ concept }) => ({
    boxes:
      concept === "nothing"
        ? []
        : [{ x1: 40, y1: 30, x2: 200, y2: 160, confidence: 0.9 }],
    width: 320,
    height: 240,
    model: "sam-3.1",
    usage: null,
  }),
  modelCall: async (args) => {
    const name = args.tools?.[0]?.name;
    if (failing(name)) throw new Error("fixture failure");
    const input = JSON.parse(args.input);
    if (name === "ground_topic")
      return {
        structured: {
          name,
          value: {
            status: "ready",
            asOf: "2026-10-31",
            needsCurrent: false,
            facts: [
              {
                statement: {
                  en: "Water boils at 100 °C at sea level.",
                  zh: "海平面上水在 100 °C 沸腾。",
                },
                value: "100",
                unit: "°C",
                url: "https://example.org/boiling-point",
              },
            ],
            note: { en: "One reference figure.", zh: "一个参考数值。" },
          },
        },
        sources: [
          { url: "https://example.org/boiling-point", title: "Boiling point reference" },
        ],
      };
    if (name === "compose_lesson")
      return {
        toolCall: {
          name,
          arguments: JSON.stringify({
            status: "ready",
            message: { en: "Fixture draft ready.", zh: "示例草稿已就绪。" },
            lesson: {
              ...(input.topic?.toLowerCase().includes("web")
                ? processLesson()
                : coolingLesson()),
              // A grounded draft names the pages it relied on.
              ...(input.references
                ? { sources: input.references.facts.map((f) => f.url) }
                : {}),
            },
          }),
        },
      };
    if (name === "judge_lesson")
      return {
        structured: {
          name,
          value: {
            scores: {
              neutralFraming: 2,
              quantityNames: 2,
              transferClarity: 2,
              bilingualParity: 2,
              assumptions: 2,
            },
            issues: [],
            summary: "Fixture judge: consistent and neutral.",
          },
        },
      };
    if (name === "try_lesson")
      return {
        toolCall: {
          name,
          arguments: JSON.stringify({
            chapters: [
              {
                prediction: "disagree",
                reason: "The gap shrinks, so cooling slows.",
                explanation: "Cooling follows the temperature gap.",
                transferAnswer: "18",
                confusions: ["The axis unit was easy to miss."],
                suggestions: ["Label the time axis."],
              },
            ],
            overall: "Short and clear.",
            rating: 4,
          }),
        },
      };
    if (name === "make_show") {
      const bi = (en, zh) => ({ en, zh });
      const slide = (kind, heading, narration, illustrate = false) => ({
        kind,
        chapter: 0,
        heading: bi(heading, heading + "（中）"),
        narration: bi(narration, narration + "（中）"),
        illustrate,
      });
      return {
        structured: {
          name,
          value: {
            slides: [
              slide("cover", "Hook", "Why does coffee cool the way it does?"),
              slide("claim", "Claim", "Is the cooling rate constant?"),
              slide("experiment", "Watch", "Watch the curve as the gap closes."),
              slide("takeaway", "Takeaway", "The gap drives the rate.", true),
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
