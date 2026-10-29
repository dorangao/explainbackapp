import { test, expect } from "@playwright/test";
import { coolingLesson } from "../test-support/generated-lessons.mjs";

test("authored edits survive navigation through the library, a gallery lesson and Create", async ({
  page,
}) => {
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page.getByLabel("Import lesson JSON").setInputFiles({
    name: "lesson.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(coolingLesson())),
  });
  await page.getByText("Edit lesson text", { exact: true }).click();
  await page
    .getByLabel("Lesson title", { exact: true })
    .fill("Unsaved review changes");
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Unsaved review changes", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Find a question. Try it for yourself.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Open lesson.*cooling/i }).click();
  await expect(page.locator(".lesson-player:visible")).toBeVisible();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Unsaved review changes", exact: true }),
  ).toBeVisible();
});

test("Back, Forward and unknown gallery links synchronize the player", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Open lesson.*cooling/i }).click();
  await expect(page.locator(".lesson-player")).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", {
      name: "Find a question. Try it for yourself.",
    }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.locator(".lesson-player")).toBeVisible();
  await page.goto("/#lesson:missing");
  await expect(
    page.getByRole("heading", {
      name: "Find a question. Try it for yourself.",
    }),
  ).toBeVisible();
});

test("language change rejects a late manual physics response and clears busy state", async ({
  page,
}) => {
  let initial: any,
    release: () => void = () => {},
    waiting = false;
  await page.route("**/api/session", async (route) => {
    const response = await route.fetch();
    initial = await response.json();
    await route.fulfill({ response });
  });
  await page.route("**/api/turn", async (route) => {
    waiting = true;
    await new Promise<void>((resolve) => (release = resolve));
    const reply = structuredClone(initial);
    reply.phase = "confirm";
    reply.claim = {
      id: "fixture",
      quote: "review fixture",
      interpretation: "LATE ENGLISH RESPONSE",
      scope: "fixture",
      decisions: [],
    };
    await route.fulfill({ json: reply });
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page.getByRole("link", { name: "Physics", exact: true }).click();
  await page.locator("#mode-manual").click();
  await page.locator("#topic").selectOption("crossing");
  await page.locator("#start").click();
  await expect(page.locator("#explanation")).toBeEnabled();
  await page
    .locator("#explanation")
    .fill("I think the function crosses its horizontal asymptote.");
  await page.locator("#submit").click();
  await expect.poll(() => waiting).toBe(true);
  await page.getByLabel("Language / 语言").selectOption("zh");
  release();
  await expect(page.locator("#explanation")).toBeEnabled();
  await page.waitForTimeout(150);
  await expect(page.locator("#claim-interpretation")).not.toContainText(
    "LATE ENGLISH RESPONSE",
  );
});

test("quantum navigation stops diagnostic polling while a provider response is pending", async ({
  page,
}) => {
  let release: () => void = () => {},
    waiting = false,
    traces = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/trace")) traces++;
  });
  await page.route("**/api/quantum/explain", async (route) => {
    waiting = true;
    await new Promise<void>((resolve) => (release = resolve));
    await route.fulfill({
      json: { explanation: "Synthetic result.", attemptsRemaining: 7 },
    });
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page.getByRole("link", { name: "Quantum", exact: true }).click();
  await page.locator("#q-showcase").click();
  await page.locator("#q-next").click();
  await page.locator("#q-ask").click();
  await expect.poll(() => waiting).toBe(true);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await page.waitForTimeout(100);
  const before = traces;
  await page.waitForTimeout(1250);
  expect(traces).toBe(before);
  release();
});

test("hidden documents suspend Studio diagnostic polling", async ({ page }) => {
  let release: () => void = () => {},
    waiting = false,
    traces = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/trace")) traces++;
  });
  await page.route("**/api/studio/compose", async (route) => {
    waiting = true;
    await new Promise<void>((resolve) => (release = resolve));
    await route.fulfill({
      json: {
        status: "ready",
        lesson: coolingLesson(),
        message: { en: "Ready", zh: "已就绪" },
        attemptsRemaining: 7,
      },
    });
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page
    .getByRole("button", { name: "Create a lesson", exact: true })
    .click();
  await expect.poll(() => waiting).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  const before = traces;
  await page.waitForTimeout(1250);
  expect(traces).toBe(before);
  release();
});

test("logging out disconnects lab resize observers", async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.ResizeObserver;
    (window as any).activeObservers = 0;
    window.ResizeObserver = class extends Original {
      active = false;
      observe(...args: Parameters<ResizeObserver["observe"]>) {
        if (!this.active) {
          this.active = true;
          (window as any).activeObservers++;
        }
        return super.observe(...args);
      }
      disconnect() {
        if (this.active) {
          this.active = false;
          (window as any).activeObservers--;
        }
        return super.disconnect();
      }
    };
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page.getByRole("link", { name: "Physics", exact: true }).click();
  await page.locator("#mode-manual").waitFor();
  await expect
    .poll(() => page.evaluate(() => (window as any).activeObservers))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).activeObservers))
    .toBe(0);
});

test("an authored animation pauses in the library and resumes only on request", async ({
  page,
}) => {
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page.getByLabel("Import lesson JSON").setInputFiles({
    name: "lesson.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(coolingLesson())),
  });
  await page
    .getByLabel(
      "I reviewed the demo definition and its assumptions for this presentation.",
    )
    .check();
  await page
    .getByRole("button", { name: "Present this lesson →", exact: true })
    .click();
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await page.getByRole("button", { name: /Test this claim/ }).click();
  await page
    .getByRole("button", { name: "Play experiment", exact: true })
    .click();
  await expect
    .poll(() => page.locator(".lesson-player").getAttribute("data-progress"))
    .not.toBe("0");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Find a question. Try it for yourself.",
    }),
  ).toBeVisible();
  const paused = await page
    .locator(".lesson-player")
    .getAttribute("data-progress");
  await page.waitForTimeout(200);
  await expect(page.locator(".lesson-player")).toHaveAttribute(
    "data-progress",
    paused!,
  );
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play experiment", exact: true }),
  ).toBeEnabled();
});

test("expired access clears the private draft and returns to the public library", async ({
  page,
}) => {
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page.getByLabel("Import lesson JSON").setInputFiles({
    name: "lesson.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(coolingLesson())),
  });
  await page.route("**/api/studio/compose", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "Tester access required.", code: "TESTER_REQUIRED" },
    }),
  );
  await page
    .getByLabel("Ask Muse to revise this draft")
    .fill("Simplify the wording.");
  await page
    .getByRole("button", { name: "Revise lesson & demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Find a question. Try it for yourself.",
    }),
  ).toBeVisible();
  await expect(page.locator(".draft-review")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Physics", exact: true }),
  ).toHaveCount(0);
});

test("a remembered draft survives a reload, reopens with no provider request and can be forgotten", async ({
  page,
}) => {
  const studioRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/studio"))
      studioRequests.push(request.url());
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page.getByLabel("Import lesson JSON").setInputFiles({
    name: "lesson.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(coolingLesson())),
  });
  await page.getByText("Edit lesson text", { exact: true }).click();
  await page
    .getByLabel("Lesson title", { exact: true })
    .fill("Remembered cooling lesson");
  await page
    .getByLabel(
      "I reviewed the demo definition and its assumptions for this presentation.",
    )
    .check();
  await page
    .getByLabel("Ask Muse to revise this draft")
    .fill("Keep this prompt for later.");
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage
          .getItem("explainback-studio-draft")
          ?.includes("Remembered cooling lesson"),
      ),
    )
    .toBe(true);
  expect(studioRequests).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Remembered cooling lesson",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Restored your last lesson/)).toBeVisible();
  await expect(
    page.getByLabel(
      "I reviewed the demo definition and its assumptions for this presentation.",
    ),
  ).toBeChecked();
  await expect(page.getByLabel("Ask Muse to revise this draft")).toHaveValue(
    "Keep this prompt for later.",
  );
  expect(studioRequests).toEqual([]);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Remembered cooling lesson",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start a new lesson", exact: true })
    .click();
  await expect(
    page.getByLabel("What would you like to explore?"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("What would you like to explore?"),
  ).toBeVisible();
  expect(studioRequests).toEqual([]);
});

test("guided replay walks a gallery lesson through every stage without clicks and pauses on a manual action", async ({
  page,
}) => {
  await page.goto("/#lesson:cooling");
  const player = page.locator(".lesson-player");
  await expect(player).toHaveAttribute("data-stage", "predict");
  await page.getByLabel("Guided replay").selectOption("fast");
  await expect(player).toHaveAttribute("data-stage", "experiment", {
    timeout: 6000,
  });
  await expect(player).toHaveAttribute("data-stage", "explain", {
    timeout: 10000,
  });
  await page
    .getByRole("button", { name: "Replay experiment", exact: true })
    .click();
  await expect(player).toHaveAttribute("data-stage", "experiment");
  await expect(
    page.getByRole("button", { name: "Resume replay", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(player).toHaveAttribute("data-stage", "experiment");
  await page
    .getByRole("button", { name: "Resume replay", exact: true })
    .click();
  await expect(player).toHaveAttribute("data-stage", "complete", {
    timeout: 20000,
  });
  await expect(page.getByText("Guided replay finished.")).toBeVisible();
});
