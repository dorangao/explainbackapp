import { test, expect } from "@playwright/test";
import { coolingLesson } from "../test-support/generated-lessons.mjs";

test("a reviewer saves a lesson, shares it by link, and a signed-out visitor opens it from the catalog", async ({
  page,
  browser,
}) => {
  const modelCalls: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/studio/"))
      modelCalls.push(r.url());
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await expect(page.getByText(/Nothing saved yet/)).toBeVisible();
  await page.getByLabel("Import lesson JSON").setInputFiles({
    name: "lesson.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(coolingLesson())),
  });
  // The show gets a cover from the fixture image model; one slide gets an illustration.
  await page.getByRole("button", { name: "Make a narrated show" }).click();
  await expect(page.locator(".show-cover img")).toBeVisible();
  await page.getByRole("button", { name: "Next slide" }).click();
  await page.getByLabel("Note for the illustrator").fill("soft morning light");
  await page.getByRole("button", { name: "Illustrate this slide" }).click();
  await expect(page.locator(".show-illustration img")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Redraw illustration" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close show" }).click();
  await page.getByRole("button", { name: "Save to my lessons" }).click();
  await expect(
    page.getByText("Saved to your lessons", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Saved copy")).toBeVisible();
  // The saved copy is private until the switch is turned on.
  await page.getByRole("switch", { name: "Private" }).click();
  const link = await page.getByLabel("Share link").inputValue();
  expect(link).toMatch(/#shared:[a-f0-9]{16}$/);
  // Saving again updates the same copy: the shelf still lists one lesson.
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved changes.")).toBeVisible();
  await page.getByRole("button", { name: "Start a new lesson" }).click();
  await expect(page.getByText("1 / 50")).toBeVisible();
  await expect(page.locator(".shelf-thumb")).toBeVisible();
  // The three image requests were the show (with its cover) and the illustration.
  expect(modelCalls.filter((u) => u.endsWith("/show")).length).toBe(1);
  expect(modelCalls.filter((u) => u.endsWith("/illustrate")).length).toBe(1);
  await expect(
    page.getByRole("switch", { name: "Shared by link" }),
  ).toBeVisible();
  expect(
    modelCalls.filter((u) => !/\/(session|show|illustrate)$/.test(u)),
  ).toEqual([]);

  // A fresh, signed-out browser opens the link and finds the lesson in the catalog.
  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto(link);
  await expect(guest.locator(".lesson-player")).toBeVisible();
  await expect(guest.getByText(/Shared by its creator/)).toBeVisible();
  await guest.getByRole("button", { name: "Disagree", exact: true }).click();
  await guest
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await expect(
    guest.getByRole("heading", { name: "The library" }),
  ).toBeVisible();
  await guest
    .getByRole("searchbox", { name: "Search lessons" })
    .fill("cooling coffee");
  await expect(guest.getByText("1 lessons")).toBeVisible();
  await expect(
    guest.locator(".lesson-card-shared .lesson-art-image"),
  ).toBeVisible();
  await guest
    .getByRole("link", { name: /Open lesson: Cooling coffee/ })
    .click();
  await expect(guest.locator(".lesson-player")).toBeVisible();
  // The saved show plays with its stored cover and illustration, signed out.
  await guest.getByRole("button", { name: "Watch the show" }).click();
  await expect(guest.locator(".show-cover img")).toBeVisible();
  await guest.getByRole("button", { name: "Next slide" }).click();
  await expect(guest.locator(".show-illustration img")).toBeVisible();
  await expect(guest.getByLabel("Note for the illustrator")).toHaveCount(0);
  await guest.getByRole("button", { name: "Close show" }).click();
  await expect(guest.getByRole("button", { name: "Sign in" })).toBeVisible();

  // Turning the link off hides the lesson from the visitor.
  await page.getByRole("switch", { name: "Shared by link" }).click();
  await guest.goto(link);
  await guest.reload();
  await expect(guest.getByText(/not available/)).toBeVisible();
  await visitor.close();
});

test("on a phone the header folds into a menu, the introductory tour stays visible and the facets fold behind More filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav).toBeHidden();
  await expect(
    page.getByRole("link", { name: /Play the tour:/ }),
  ).toBeInViewport();
  await expect(page.getByRole("button", { name: "Source" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "From the evaluation" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "More filters" }).click();
  await expect(
    page.getByRole("button", { name: "From the evaluation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "About", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "About ExplainBack" }),
  ).toBeVisible();
  await expect(nav).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("the catalog filters reviewed lessons by kind", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".catalog-count")).toHaveText(/\d+ lessons/);
  await page.getByRole("checkbox", { name: "From a sketch" }).click();
  await expect(page.locator(".catalog-count")).toHaveText("1 lessons");
  await expect(
    page.getByRole("heading", { name: "Pendulum sketch: length and swing" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All" }).click();
  await page
    .getByRole("searchbox", { name: "Search lessons" })
    .fill("nothing here");
  await expect(page.getByText(/No lesson matches/)).toBeVisible();
});
