import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
test.use({ serviceWorkers: "block" });

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
