// Deterministic local browser fixture: no environment files, provider credentials or paid calls.
import { createApp } from "../src/server.mjs";
import {
  coolingLesson,
  processLesson,
} from "../test-support/generated-lessons.mjs";
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
