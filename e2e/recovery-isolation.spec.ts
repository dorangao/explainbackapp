import { test, expect } from "@playwright/test";
import { coolingLesson } from "../test-support/generated-lessons.mjs";

async function draft(page: import("@playwright/test").Page) {
  await page.goto("/#invite:BROWSER-TEST-CODE");
  const lesson = coolingLesson();
  lesson.title.en = "Private recovery from reviewer A";
  await page.getByLabel("Import lesson JSON").setInputFiles({
    name: "lesson.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(lesson)),
  });
  await expect(
    page.getByRole("heading", { name: lesson.title.en, exact: true }),
  ).toBeVisible();
}

test("sign-out prevents another reviewer restoring the private draft", async ({
  page,
}) => {
  await draft(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page
      .locator(".site-header")
      .getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.goto("/#invite:BROWSER-OTHER-CODE");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Private recovery from reviewer A",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("What would you like to explore?"),
  ).toBeVisible();
});

test("sign-out invalidates a second tab and its late page-exit recovery write", async ({
  page,
}) => {
  await draft(page);
  const other = await page.context().newPage();
  await other.goto("/#create");
  await expect(
    other.getByRole("heading", {
      name: "Private recovery from reviewer A",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    other.getByRole("heading", {
      name: "Private recovery from reviewer A",
      exact: true,
    }),
  ).toHaveCount(0);
  await other.close();
  await page.goto("/#invite:BROWSER-OTHER-CODE");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Private recovery from reviewer A",
      exact: true,
    }),
  ).toHaveCount(0);
});
