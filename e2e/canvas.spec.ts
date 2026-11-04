import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
test.use({ serviceWorkers: "block" });

for (const [width, language] of [
  [320, "en"],
  [390, "zh"],
  [1440, "en"],
] as const) {
  test(`canvas drawing can reopen after testing at ${width}px (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await page.goto("/#lesson:cooling");
    if (language === "zh") {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByLabel("Language / 语言").selectOption("zh");
      await page.getByRole("button", { name: "关闭菜单", exact: true }).click();
    }
    const canvas = page.getByRole("region", {
      name: /Prediction canvas|预测画布/,
    });
    const testClaim = page.getByRole("button", {
      name: /Test this claim|检验这个观点/,
    });
    await expect(canvas).toBeVisible();
    const canvasBox = (await canvas.boundingBox())!;
    expect((await testClaim.boundingBox())!.y).toBeGreaterThanOrEqual(
      canvasBox.y + canvasBox.height,
    );
    await page.getByRole("button", { name: /^(Not sure|不确定)$/ }).click();
    await testClaim.click();
    // A learner who skipped the optional canvas can still add a sketch afterward.
    await canvas.getByRole("button", { name: /Add a sketch|添加草图/ }).click();
    await expect(page.locator(".lesson-player")).toHaveAttribute(
      "data-stage",
      "predict",
    );
    await expect(testClaim).toBeDisabled();
    const input = canvas.locator(".prediction-input");
    async function draw(end: number) {
      await input.scrollIntoViewIfNeeded();
      const b = (await input.boundingBox())!;
      await page.mouse.move(b.x + 4, b.y + 4);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width - 4, b.y + b.height * end, {
        steps: 10,
      });
      await page.mouse.up();
    }
    await draw(0.8);
    const sketch = canvas.locator(".prediction-path");
    const original = (await sketch.getAttribute("d"))!;
    await page.getByRole("button", { name: /^(Not sure|不确定)$/ }).click();
    await testClaim.click();
    await expect(canvas.locator(".calculated-curve")).toBeVisible();
    await expect(input).toHaveCount(0);
    const edit = canvas.getByRole("button", {
      name: /^(Edit sketch|编辑草图)$/,
    });
    await edit.focus();
    await edit.press("Enter");
    await expect(page.locator(".lesson-player")).toHaveAttribute(
      "data-stage",
      "predict",
    );
    await expect(canvas.locator(".calculated-curve")).toHaveCount(0);
    await expect(sketch).toHaveAttribute("d", original);
    await expect(input).toBeVisible();
    await expect(testClaim).toBeDisabled();
    await draw(0.4);
    await expect(sketch).not.toHaveAttribute("d", original);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `output/playwright/canvas-edit-${width}-${language}.png`,
    });
    expect(posts).toEqual([]);
  });
}

test("public canvas example opens from the library and compares a drawing without model requests", async ({
  page,
}) => {
  const modelRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/studio/"))
      modelRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#studio");
  await page.getByRole("link", { name: "Try the canvas", exact: true }).click();
  await expect(page).toHaveURL(/#lesson:sketch-pendulum$/);
  const canvas = page.getByRole("region", { name: "Prediction canvas" });
  await expect(canvas).toBeVisible();
  await expect(
    page.locator("aside").getByAltText("Source sketch or photo"),
  ).toBeVisible();
  const input = canvas.locator(".prediction-input");
  await input.scrollIntoViewIfNeeded();
  const bounds = (await input.boundingBox())!;
  await page.mouse.move(bounds.x + 2, bounds.y + bounds.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height * 0.5,
    { steps: 8 },
  );
  await page.mouse.move(
    bounds.x + bounds.width - 2,
    bounds.y + bounds.height * 0.1,
    { steps: 8 },
  );
  await page.mouse.up();
  const prediction = canvas.locator(".prediction-path");
  await expect(prediction).toBeVisible();
  const path = await prediction.getAttribute("d");
  await expect(canvas.locator(".calculated-curve")).toHaveCount(0);
  await page.getByRole("button", { name: "Not sure", exact: true }).click();
  await page.getByRole("button", { name: /Test this claim/ }).click();
  await page
    .getByRole("button", { name: "Show final state", exact: true })
    .click();
  await page.getByRole("button", { name: /Explain the result/ }).click();
  await expect(canvas.locator(".calculated-curve")).toBeVisible();
  await expect(prediction).toHaveAttribute("d", path!);
  await expect(
    page.getByRole("button", { name: /Check my explanation with Muse/ }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "output/playwright/canvas-pendulum-comparison.png",
    fullPage: true,
  });
  await page.getByLabel("Gravitational acceleration slider").fill("1.6");
  await expect(
    page.getByRole("heading", { name: "Sketch your prediction" }),
  ).toBeVisible();
  await expect(prediction).toHaveCount(0);
  await expect(canvas.locator(".calculated-curve")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Language / 语言" })
    .selectOption("zh");
  await expect(page.getByRole("region", { name: "预测画布" })).toBeVisible();
  expect(modelRequests).toEqual([]);
  expect(errors).toEqual([]);
});

async function createCanvas(page: Page, manual = false) {
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await page
    .getByLabel("What would you like to explore?")
    .fill("Cooling coffee from a sketch");
  await page
    .locator('input[type="file"][accept^="image/"]')
    .setInputFiles("public/gallery/pendulum-sketch.png");
  await page
    .getByRole("button", { name: "Create a lesson", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Lesson canvas connection" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Object name").fill("cup");
  if (manual) {
    const image = editor.locator(".canvas-regions");
    await image.scrollIntoViewIfNeeded();
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, {
      steps: 4,
    });
    await page.mouse.up();
  } else {
    await editor.getByRole("button", { name: "Find with SAM 3.1" }).click();
    await editor.getByRole("button", { name: "Select cup 1" }).press("Enter");
  }
  await editor.getByRole("button", { name: "Confirm connection" }).click();
  await page
    .getByLabel(
      "I reviewed the demo definition and its assumptions for this presentation.",
    )
    .check();
  await page.getByRole("button", { name: "Present this lesson →" }).click();
}

test("revisions retain an unchanged connection and disclose a changed control", async ({
  page,
}) => {
  await createCanvas(page);
  await page
    .getByRole("button", { name: "Back to Create", exact: true })
    .click();
  let revisions = 0;
  await page.route("**/api/studio/compose", async (route) => {
    const lesson = structuredClone(route.request().postDataJSON().draft);
    delete lesson.chapters[0].canvas;
    lesson.chapters[0].explanation.en =
      "A clearer explanation of the same model.";
    if (++revisions === 2) lesson.chapters[0].demo.inputs[0].max = 110;
    await route.fulfill({
      json: {
        status: "ready",
        lesson,
        message: { en: "Ready", zh: "已就绪" },
        attemptsRemaining: 6,
      },
    });
  });
  await page
    .getByLabel("Ask Muse to revise this draft")
    .fill("Clarify the explanation");
  await page
    .getByRole("button", { name: "Revise lesson & demo", exact: true })
    .click();
  const review = page.getByRole("checkbox", { name: /I reviewed/ });
  await expect(page.getByText(/Revision ready/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove connection", exact: true }),
  ).toBeVisible();
  await expect(review).not.toBeChecked();
  await expect(page.locator(".revision-summary")).not.toContainText(
    "Picture connection",
  );
  await page
    .getByLabel("Ask Muse to revise this draft")
    .fill("Change the initial-temperature range");
  await page.getByRole("button", { name: /Send changes to Muse/ }).click();
  await expect(
    page.getByText(/Some picture connections were removed/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove connection", exact: true }),
  ).toHaveCount(0);
  await expect(review).not.toBeChecked();
  const removed = page.locator('.revision-summary li[data-kind="removed"]');
  await expect(removed).toContainText("Picture connection");
  await expect(removed).toContainText("cup");
  await expect(
    page.getByRole("img", { name: "Source sketch or photo", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language / 语言").selectOption("zh");
  await expect(removed).toContainText("图片关联");
  await page
    .locator(".revision-summary")
    .screenshot({ path: "output/playwright/canvas-revision-diff.png" });
});

test("image → confirmed connection → pointer prediction → recomputed feedback; reload and changed controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createCanvas(page);
  const input = page.locator(".prediction-input");
  await input.scrollIntoViewIfNeeded();
  const rect = (await input.boundingBox())!;
  await page.mouse.move(rect.x + 10, rect.y + 15);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2, {
    steps: 8,
  });
  await page.mouse.move(rect.x + rect.width - 10, rect.y + rect.height - 20, {
    steps: 8,
  });
  await page.mouse.up();
  const prediction = page.locator(".prediction-path");
  await expect(prediction).toBeVisible();
  const path = await prediction.getAttribute("d");
  await expect(
    page.locator(".prediction-canvas .calculated-curve"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Disagree", exact: true }).click();
  await page.getByRole("button", { name: /Test this claim/ }).click();
  await page
    .getByRole("button", { name: "Show final state", exact: true })
    .click();
  await page.getByRole("button", { name: /Explain the result/ }).click();
  await expect(
    page.locator(".prediction-canvas .calculated-curve"),
  ).toBeVisible();
  await expect(prediction).toHaveAttribute("d", path!);
  await page
    .getByLabel("Explain what changed and why")
    .fill("I expected a constant rate, but the curve bends.");
  const sent = page.waitForRequest((r) =>
    r.url().endsWith("/api/studio/guide"),
  );
  await page
    .getByRole("button", { name: /Check my explanation with Muse/ })
    .click();
  const body = (await sent).postDataJSON();
  expect(body.drawing.points.length).toBeGreaterThan(2);
  expect(body.lesson.chapters[0].canvas.input).toBe("initial");
  await expect(page.locator(".model-feedback")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("explainback-studio-draft") || "{}")
            .guide?.["0"]?.reply?.verdict,
      ),
    )
    .toBe("partly");
  await page.reload();
  await expect(page.locator(".canvas-object img")).toBeVisible();
  await expect(prediction).toHaveAttribute("d", path!);
  await expect(page.locator(".model-feedback")).toBeVisible();
  await page.screenshot({
    path: "output/playwright/canvas-comparison.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "cup → Initial temperature" }).click();
  await expect(
    page.getByLabel("Initial temperature (°C)", { exact: true }),
  ).toBeFocused();
  await page.getByLabel("Initial temperature slider").fill("90");
  await expect(
    page.getByRole("heading", { name: "Sketch your prediction" }),
  ).toBeVisible();
  await expect(prediction).toHaveCount(0);
  await expect(page.locator(".model-feedback")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("keyboard prediction and mobile themes remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createCanvas(page);
  await page
    .getByText("Enter three points with the keyboard", { exact: true })
    .click();
  await page.getByLabel("Start prediction", { exact: true }).fill("80");
  await page.getByLabel("Middle prediction", { exact: true }).fill("50");
  await page.getByLabel("End prediction", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Use these points" }).click();
  for (const theme of ["paper", "glass", "meta"] as const) {
    for (const mode of ["light", "dark"] as const) {
      await page.evaluate(
        (value) =>
          window.explainbackAppearance.select({
            ...value,
            reduceTransparency: false,
          }),
        { theme, mode },
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const audit = await new AxeBuilder({ page })
        .include(".prediction-canvas")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.failureSummary),
          })),
      ).toEqual([]);
    }
  }
  await page.screenshot({
    path: "output/playwright/canvas-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Clear prediction drawing" }).click();
  await expect(page.locator(".prediction-path")).toHaveCount(0);
});

test("manual regions need no SAM request and a canceled stroke keeps the previous prediction", async ({
  page,
}) => {
  const detectRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/studio/detect")) detectRequests.push(r.url());
  });
  await createCanvas(page, true);
  expect(detectRequests).toEqual([]);
  await expect(
    page.getByRole("button", { name: "cup → Initial temperature" }),
  ).toBeVisible();
  await page
    .getByText("Enter three points with the keyboard", { exact: true })
    .click();
  await page.getByLabel("Start prediction", { exact: true }).fill("80");
  await page.getByLabel("Middle prediction", { exact: true }).fill("50");
  await page.getByLabel("End prediction", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Use these points" }).click();
  const path = await page.locator(".prediction-path").getAttribute("d");
  const input = page.locator(".prediction-input");
  await input.scrollIntoViewIfNeeded();
  const bounds = (await input.boundingBox())!;
  await page.mouse.move(bounds.x + 10, bounds.y + 10);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 30, bounds.y + 40, { steps: 3 });
  await input.dispatchEvent("pointercancel", {
    pointerId: 1,
    pointerType: "mouse",
  });
  await page.mouse.up();
  await expect(page.locator(".prediction-path")).toHaveAttribute("d", path!);
});
