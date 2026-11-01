import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

// Route-based fixtures must reach Playwright rather than the app's worker.
// Cache upgrades are exercised separately in test/appearance-cache.test.mjs.
test.use({ serviceWorkers: "block" });

const choices = [
  ["paper", "Paper Default"],
  ["midnight", "Midnight Paper"],
  ["glass", "Liquid Glass"],
  ["meta", "Meta Blue"],
] as const;
async function choose(page: Page, name: string) {
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("radio", { name, exact: true }).check();
  await page.keyboard.press("Escape");
}
async function audit(page: Page, label: string) {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished)),
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    label,
  ).toEqual([]);
}

const rgb = (value: string) =>
  value
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map(Number);
const luminance = (value: string) =>
  rgb(value)
    .map((channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: string, b: string) => {
  const l = [luminance(a), luminance(b)];
  return (Math.max(...l) + 0.05) / (Math.min(...l) + 0.05);
};

test("active scientific diagrams retain readable labels and their named series colors", async ({
  page,
}) => {
  // Render the real diagram modules with synthetic scenarios, without any model call.
  const files = new Set([
    "suction-view.mjs",
    "suction.mjs",
    "flight-view.mjs",
    "flight.mjs",
    "roll-view.mjs",
  ]);
  await page.route("**/__appearance-fixture/*.mjs", async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!files.has(file)) return route.abort();
    await route.fulfill({
      contentType: "text/javascript",
      body: await readFile(
        new URL(`../public/${file}`, import.meta.url),
        "utf8",
      ),
    });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    const source = "/__appearance-fixture/";
    const { mountSuctionLab } = await import(source + "suction-view.mjs");
    const { suctionScenario } = await import(source + "suction.mjs");
    const { drawFlightView } = await import(source + "flight-view.mjs");
    const { flightScenario } = await import(source + "flight.mjs");
    const fixture = document.createElement("section");
    fixture.id = "diagram-fixture";
    fixture.className = "app-shell";
    document.body.append(fixture);
    const robot = document.createElement("div");
    fixture.append(robot);
    mountSuctionLab(robot).set({
      language: "en",
      visible: true,
      preview: false,
      locked: false,
      primaryReference: false,
      session: {
        problem: { id: "suction" },
        history: [],
        graph: { scenario: suctionScenario({}, "default") },
      },
    });
    const scene = document.createElement("div"),
      plot = document.createElement("div"),
      panel = document.createElement("div");
    scene.className = "flight-scene";
    fixture.append(scene, plot, panel);
    drawFlightView(
      scene,
      plot,
      panel,
      { scenario: flightScenario() },
      "en",
      0.4,
    );
  });
  for (const [id, name] of choices) {
    await choose(page, name);
    const colors = await page.locator("#diagram-fixture").evaluate((root) => {
      const style = (selector: string) =>
        getComputedStyle(root.querySelector(selector)!);
      return {
        robot: style('[data-el="robot"] text[x="205"]').fill,
        body: style('[data-el="robot"] rect').fill,
        force: style('[data-el="robot"] text[y="103"]').fill,
        caption: style('.flight-scene text[y="294"]').fill,
        scene: style(".flight-scene").backgroundColor,
      };
    });
    expect
      .soft(contrast(colors.robot, colors.body), `${id} Robot label`)
      .toBeGreaterThanOrEqual(4.5);
    expect.soft(colors.force, `${id} authored force label`).toBe(colors.body);
    const [r, g, b] = rgb(colors.body);
    expect.soft(g > r && g > b, `${id} series described as green`).toBe(true);
    expect
      .soft(contrast(colors.caption, colors.scene), `${id} flight caption`)
      .toBeGreaterThanOrEqual(4.5);
  }
});

test("a saved theme is applied while the React bundle is still blocked", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "explainback-appearance",
      JSON.stringify({ theme: "midnight", reduceTransparency: false }),
    ),
  );
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(20, 36, 31)",
  );
  await expect(page.locator("#root")).toBeEmpty();
});

test("themes preserve a lesson's state and do not make model requests", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/#lesson:cooling");
  await page.getByRole("button", { name: "Disagree", exact: true }).click();
  await page.getByRole("button", { name: /Test this claim/ }).click();
  await page
    .getByRole("button", { name: "Show final state", exact: true })
    .click();
  for (const [id, name] of choices) {
    await choose(page, name);
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    await expect(
      page.getByRole("button", { name: "Explain the result →", exact: true }),
    ).toBeEnabled();
    await expect(page).toHaveURL(/#lesson:cooling$/);
  }
  expect(posts).toEqual([]);
});

test("theme changes preserve an unsaved author draft and survive reload", async ({
  page,
}) => {
  await page.goto("/#invite:BROWSER-TEST-CODE");
  const topic = page.getByLabel("What would you like to explore?");
  await topic.fill("My unsaved lesson about cooling");
  await choose(page, "Midnight Paper");
  await expect(topic).toHaveValue("My unsaved lesson about cooling");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
});

test("keyboard radio selection, Escape, and glass opacity work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("radio", { name: "Midnight Paper" }),
  ).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Liquid Glass" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Reduce transparency" }).check();
  await expect(page.locator(".site-header")).toHaveCSS(
    "backdrop-filter",
    "none",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Appearance", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduce-transparency",
    "true",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.goto("/#show:cooling");
  await expect(page.locator(".show-stage")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".show-player .show-credits")).toHaveCSS(
    "color",
    "rgb(0, 0, 0)",
  );
});

test("phone menu exposes the bilingual picker without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Appearance", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByLabel("Language / 语言").selectOption("zh");
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page.getByRole("radio", { name: "夜色纸感" }).check();
  const box = await page.locator(".appearance-panel").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await audit(page, "Chinese mobile picker");
});

for (const [id, name] of choices) {
  test(`${name}: library, picker and lesson pass the automated contrast audit`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/");
    await choose(page, name);
    await audit(page, `${id} library`);
    await page.screenshot({
      path: `output/theme-design-2026-11-01/${id}-library.png`,
      fullPage: false,
    });
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await audit(page, `${id} picker`);
    await page.keyboard.press("Escape");
    await page.goto("/#lesson:cooling");
    await page.getByRole("button", { name: "Disagree", exact: true }).click();
    await page.getByRole("button", { name: /Test this claim/ }).click();
    await audit(page, `${id} experiment`);
    await page.screenshot({
      path: `output/theme-design-2026-11-01/${id}-lesson.png`,
    });
  });
  test(`${name}: remaining screens and phone layouts stay readable`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await choose(page, name);
    for (const hash of [
      "about",
      "evaluation",
      "compare:logistic-growth-en",
      "show:cooling",
    ]) {
      await page.goto(`/#${hash}`);
      await audit(page, `${id} ${hash}`);
    }
    await page.goto("/#invite:BROWSER-TEST-CODE");
    await expect(
      page.getByLabel("What would you like to explore?"),
    ).toBeVisible();
    await audit(page, `${id} author form`);
    await page
      .getByLabel("What would you like to explore?")
      .fill("Cooling coffee");
    await page
      .getByRole("button", { name: "Create a lesson", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Cooling coffee", exact: true }),
    ).toBeVisible();
    await audit(page, `${id} draft review`);
    for (const hash of ["physics", "quantum"]) {
      await page.goto(`/#${hash}`);
      await expect(page.locator(".lab-root:visible")).toBeVisible();
      await audit(page, `${id} ${hash} bench`);
      await page.screenshot({
        path: `output/theme-design-2026-11-01/${id}-${hash}.png`,
        fullPage: true,
      });
    }
    await page.goto("/");
    for (const width of [390, 820, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const language of ["en", "zh"]) {
        if (
          width === 390 &&
          !(await page.getByLabel("Language / 语言").isVisible())
        ) {
          await page.locator(".menu-button").click();
        }
        await page.getByLabel("Language / 语言").selectOption(language);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${id} ${language} ${width}px`,
        ).toBeLessThanOrEqual(width);
        await audit(page, `${id} ${language} ${width}px`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `output/theme-design-2026-11-01/${id}-mobile.png`,
      fullPage: false,
    });
  });
}
