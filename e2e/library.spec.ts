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
  await expect(
    page.getByRole("switch", { name: "Shared by link" }),
  ).toBeVisible();
  expect(modelCalls).toEqual([]);

  // A fresh, signed-out browser opens the link and finds the lesson in the catalog.
  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto(link);
  await expect(guest.locator(".lesson-player")).toBeVisible();
  await expect(guest.getByText(/Shared by its creator/)).toBeVisible();
  await guest.getByRole("button", { name: "Disagree", exact: true }).click();
  await guest.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(
    guest.getByRole("heading", { name: "Fresh from the Studio." }),
  ).toBeVisible();
  await guest
    .getByRole("searchbox", { name: "Search lessons" })
    .fill("cooling coffee");
  await expect(guest.getByText("1 lessons")).toBeVisible();
  await guest
    .getByRole("link", { name: /Open lesson: Cooling coffee/ })
    .click();
  await expect(guest.locator(".lesson-player")).toBeVisible();
  await expect(
    guest.getByRole("button", { name: "Preview access" }),
  ).toBeVisible();

  // Turning the link off hides the lesson from the visitor.
  await page.getByRole("switch", { name: "Shared by link" }).click();
  await guest.goto(link);
  await guest.reload();
  await expect(guest.getByText(/not available/)).toBeVisible();
  await visitor.close();
});

test("the catalog filters reviewed lessons by kind", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/\d+ lessons/)).toBeVisible();
  await page.getByRole("button", { name: "From a sketch" }).click();
  await expect(page.getByText("1 lessons")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pendulum sketch: length and swing" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All" }).click();
  await page
    .getByRole("searchbox", { name: "Search lessons" })
    .fill("nothing here");
  await expect(page.getByText(/No lesson matches/)).toBeVisible();
});
