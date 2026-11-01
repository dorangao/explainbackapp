import { test, expect } from "@playwright/test";

test.describe("stale review assets", () => {
  test.use({ serviceWorkers: "block" });
  test("a creation remains reviewable when an old review chunk is unavailable", async ({
    page,
  }) => {
    await page.route("**/assets/DraftReview-*.js", (route) => route.abort());
    await page.goto("/#invite:BROWSER-TEST-CODE");
    await page
      .getByLabel("What would you like to explore?")
      .fill("Cooling coffee");
    await page
      .getByRole("button", { name: "Create a lesson", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Cooling coffee", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Present this lesson →" }),
    ).toBeDisabled();
  });
});

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
  await page
    .getByRole("navigation", { name: "当前位置" })
    .getByRole("link", { name: "课程库", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "课程库" })).toBeVisible();
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
      name: "The library",
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
    if (await page.getByRole("button", { name: /Finish lesson/ }).isEnabled())
      break;
  }
  await page.getByRole("button", { name: /Finish lesson/ }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer explanation." }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Library", exact: true })
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
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await page.getByRole("link", { name: /Open the bench: Physics/ }).click();
  await expect(
    page.getByRole("heading", { name: "Physics & math", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start demo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await page.getByRole("link", { name: /Open the bench: Quantum/ }).click();
  await expect(
    page.getByRole("heading", { name: "Quantum computing", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language / 语言").selectOption("zh");
  await expect(
    page.getByRole("heading", { name: "量子计算", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "课程库", exact: true })
    .click();
  await page.getByRole("link", { name: /打开工作台: 物理/ }).click();
  await expect(
    page.getByRole("heading", { name: "物理与数学", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.locator(".lab-workspace")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the guided demo starts when the server has tracing off", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, traceEnabled: false } });
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await page.getByRole("link", { name: /Open the bench: Physics/ }).click();
  const start = page.getByRole("button", { name: "Start demo", exact: true });
  await expect(start).toBeEnabled();
  await expect(page.locator("#auto-demo-note")).toContainText(
    "request console is off",
  );
  await start.click();
  await expect(page.locator("#auto-demo-status")).toContainText(
    "Paused · read, then select Next",
  );
  await expect(page.locator("#auto-demo-progress")).toContainText("Step 1 of");
  await page.getByRole("button", { name: "Stop demo", exact: true }).click();
  await expect(page.locator("#auto-demo-status")).toContainText("Demo stopped");
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
  await expect(page.getByRole("heading", { name: "课程库" })).toBeVisible();
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
  // On a phone the language control sits behind the Menu button.
  await page.getByRole("button", { name: "Menu" }).click();
  for (const language of ["en", "zh"]) {
    await page.getByLabel("Language / 语言").selectOption(language);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "关闭菜单" }).click();
  await page.locator(".gallery .lesson-link").first().click();
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
      name: "The library",
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

test("evaluation showcase lessons open unedited with their provenance, and two models compare side by side without a model request", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") requests.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "From the evaluation" }).click();
  await expect(page.getByText("14 lessons")).toBeVisible();
  await page
    .getByRole("link", {
      name: /Compare the two models: Why does a bacterial/,
    })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Compare the two models", exact: true }),
  ).toBeVisible();
  // The hidden library keeps its cards in the DOM, so look inside the comparison only.
  const comparison = page.locator(".comparison");
  await expect(comparison.locator(".compare-column")).toHaveCount(2);
  await expect(
    comparison.getByRole("rowheader", { name: "Muse Wonder" }),
  ).toBeVisible();
  await expect(
    comparison.getByRole("rowheader", { name: "Muse Spark" }),
  ).toBeVisible();
  await comparison
    .getByText("Lesson and rubric details", { exact: true })
    .nth(1)
    .click();
  await expect(comparison.getByText("AI wording rubric · 7/10")).toBeVisible();
  await comparison
    .getByRole("link", { name: /Open lesson: Why Bacterial Growth Slows/ })
    .click();
  await expect(page.locator(".lesson-player")).toBeVisible();
  const provenance = page.locator(".lesson-provenance");
  await expect(provenance.getByText(/shown here unedited/)).toBeVisible();
  await expect(provenance.getByText(/scored it 7\/10/)).toBeVisible();
  await provenance
    .getByRole("link", { name: "Compare the two models" })
    .click();
  await expect(page.getByText("SAME QUESTION, TWO MODELS")).toBeVisible();
  // The evaluation card is a page of the app, read from docs/evaluation.md.
  await comparison.getByRole("link", { name: "Evaluation card" }).click();
  const card = page.locator(".evaluation-card");
  await expect(
    card.getByRole("heading", { level: 1, name: "Evaluation card" }),
  ).toBeVisible();
  await expect(
    card.getByRole("heading", { name: "What these checks do not establish" }),
  ).toBeVisible();
  await expect(
    card.getByRole("cell", { name: "studio-breadth-v1", exact: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: "Source on GitHub" }),
  ).toHaveAttribute("href", /docs\/evaluation\.md$/);
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "The library",
    }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("the hero's Play the tour link opens the how-to show already narrating, without a model request", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") requests.push(r.url());
  });
  await page.goto("/");
  await page
    .getByRole("link", {
      name: "Play the tour: How ExplainBack makes a lesson",
    })
    .click();
  await expect(page).toHaveURL(/#show:explainback\/play$/);
  await expect(page.locator(".show-player")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "How ExplainBack makes a lesson",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("on a phone, Sign in folds the menu and brings the access panel into view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await page
    .locator(".site-menu")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".access-panel")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.locator("#reviewer-code")).toBeFocused();
});
