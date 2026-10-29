import { test, expect } from "@playwright/test";

test("public gallery opens a lesson, preserves progress across language changes and returns to the gallery", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") requests.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Open lesson.*cooling/i }).click();
  await page.getByRole("button", { name: "Disagree", exact: true }).click();
  await page
    .getByRole("button", { name: "Test this claim", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Show final state", exact: true })
    .click();
  await page.getByLabel("Language / 语言").selectOption("zh");
  await expect(
    page.getByRole("button", { name: "解释结果 →", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "解释结果 →", exact: true }).click();
  await expect(page.getByText("计算证据", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回课程库", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "找一个问题，亲手试一试。" }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("reviewer entry creates a lesson and requires review again after editing", async ({
  page,
}) => {
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await expect(
    page.getByLabel("What would you like to explore?"),
  ).toBeVisible();
  await page
    .getByLabel("What would you like to explore?")
    .fill("Cooling coffee");
  await page
    .getByRole("button", { name: "Create a lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cooling coffee", exact: true }),
  ).toBeVisible();
  const present = page.getByRole("button", {
    name: "Present this lesson →",
    exact: true,
  });
  await expect(present).toBeDisabled();
  await page
    .getByLabel(
      "I reviewed the demo definition and its assumptions for this presentation.",
    )
    .check();
  await expect(present).toBeEnabled();
  await page.getByText("Edit lesson text", { exact: true }).click();
  await page
    .getByLabel("Lesson title", { exact: true })
    .fill("My cooling lesson");
  await expect(present).toBeDisabled();
  await page
    .getByLabel(
      "I reviewed the demo definition and its assumptions for this presentation.",
    )
    .check();
  await present.click();
  await expect(
    page.getByRole("button", { name: "Agree", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByText("My cooling lesson", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Find a question. Try it for yourself.",
    }),
  ).toBeVisible();
});

test("process lesson completes locally and changing a model input resets the prediction", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#lesson:web-cache");
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await page.getByRole("button", { name: /Test this claim/ }).click();
  await page
    .getByRole("button", { name: "Show final state", exact: true })
    .click();
  await page.getByRole("button", { name: /Explain the result/ }).click();
  await page.getByRole("button", { name: /Try a fresh case/ }).click();
  const choices = page.locator(".choice-list button");
  for (let i = 0; i < (await choices.count()); i++) {
    await choices.nth(i).click();
    if (await page.getByRole("button", { name: /Next chapter/ }).isEnabled())
      break;
  }
  await page.getByRole("button", { name: /Next chapter/ }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer explanation." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Back to library", exact: true })
    .click();
  await page.getByRole("link", { name: /Open lesson.*cooling/i }).click();
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await page.getByRole("button", { name: /Test this claim/ }).click();
  const control = page.locator(".parameter input[type=number]").first();
  await control.focus();
  await control.blur();
  await expect(page.locator(".lesson-player")).toHaveAttribute(
    "data-stage",
    "experiment",
  );
  await control.fill("90");
  await control.blur();
  await expect(page.locator(".lesson-player")).toHaveAttribute(
    "data-stage",
    "predict",
  );
  await expect(
    page.getByRole("button", { name: /Test this claim/ }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test("both retained labs mount, switch language, navigate and remount without errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Physics", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Physics & math", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start demo", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Quantum", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quantum computing", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language / 语言").selectOption("zh");
  await expect(
    page.getByRole("heading", { name: "量子计算", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "物理", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "物理与数学", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.locator(".lab-workspace")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("late compose results cannot restore a draft after changing language or signing out", async ({
  page,
}) => {
  let release: () => void = () => {};
  let intercepted = 0;
  await page.route("**/api/studio/compose", async (route) => {
    intercepted++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await route.continue();
    } catch {}
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page
    .getByLabel("What would you like to explore?")
    .fill("Cooling coffee");
  await page
    .getByRole("button", { name: "Create a lesson", exact: true })
    .click();
  await expect(page.locator(".request-progress")).toBeVisible();
  await expect.poll(() => intercepted).toBe(1);
  await page.getByLabel("Language / 语言").selectOption("zh");
  release();
  await expect(page.locator(".draft-review")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "创建课程", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "创建课程", exact: true }).click();
  await expect(page.locator(".request-progress")).toBeVisible();
  await expect.poll(() => intercepted).toBe(2);
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  release();
  await expect(
    page.getByRole("heading", { name: "找一个问题，亲手试一试。" }),
  ).toBeVisible();
  await expect(page.locator(".draft-review")).toHaveCount(0);
});

test("mobile library and player fit the viewport in both languages with keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  for (const language of ["en", "zh"]) {
    await page.getByLabel("Language / 语言").selectOption(language);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator(".lesson-link").first().click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("import, invalid definition, export and revision retain the review gate", async ({
  page,
}) => {
  const { coolingLesson } =
    await import("../test-support/generated-lessons.mjs");
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page.getByLabel("Import lesson JSON").setInputFiles({
    name: "lesson.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(coolingLesson())),
  });
  await expect(
    page.getByRole("heading", { name: "Cooling coffee", exact: true }),
  ).toBeVisible();
  const present = page.getByRole("button", {
    name: "Present this lesson →",
    exact: true,
  });
  await expect(present).toBeDisabled();
  await page
    .getByText("Edit formulas, controls or steps (JSON)", { exact: true })
    .click();
  await page.getByLabel("Bilingual demo definition").fill("{broken");
  await page
    .getByRole("button", { name: "Validate & apply definition", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Definition rejected");
  await expect(
    page.getByRole("button", { name: "Export lesson JSON", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Discard definition edits", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export lesson JSON", exact: true })
    .click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(coolingLesson());
  await page
    .getByLabel(
      "I reviewed the demo definition and its assumptions for this presentation.",
    )
    .check();
  await page
    .getByLabel("Ask Muse to revise this draft")
    .fill("Simplify the wording.");
  await page
    .getByRole("button", { name: "Revise lesson & demo", exact: true })
    .click();
  await expect(page.locator(".request-progress")).toHaveCount(0);
  await expect(present).toBeDisabled();
});

test("attaching an image stays local until the explicit create request", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/studio/compose"))
      providerRequests.push(r.postData() ?? "");
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page
    .getByLabel("Add a photo, sketch or diagram")
    .setInputFiles("public/apple-touch-icon.png");
  await expect(page.getByAltText("Attached image preview")).toBeVisible();
  expect(providerRequests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Create a lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cooling coffee", exact: true }),
  ).toBeVisible();
  expect(providerRequests).toHaveLength(1);
  expect(JSON.parse(providerRequests[0]).image).toMatch(
    /^data:image\/png;base64,/,
  );
  await expect(page.getByAltText("Attached image preview")).toHaveCount(0);
});

test("unknown lesson links fall back to the library without a provider call", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") calls.push(r.url());
  });
  await page.goto("/#lesson:unknown-lesson");
  await expect(
    page.getByRole("heading", {
      name: "Find a question. Try it for yourself.",
    }),
  ).toBeVisible();
  expect(calls).toEqual([]);
});

test("an invite opened from a public lesson enters the authoring workspace", async ({
  page,
}) => {
  await page.goto("/#lesson:cooling");
  await expect(page.locator(".lesson-player")).toBeVisible();
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await expect(
    page.getByLabel("What would you like to explore?"),
  ).toBeVisible();
  await expect(page.locator(".lesson-player")).toHaveCount(0);
});
