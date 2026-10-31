import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.1 A/AA automated audit (axe-core) over the main screens. It catches what a
// machine can check: contrast, names, roles, landmarks, labels. It does not replace a
// manual audit with a screen reader and keyboard, which the repo does not claim.
const audit = async (page: import("@playwright/test").Page, screen: string) => {
  // Sections fade in; let that finish so axe measures the settled colours.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished)),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  // One line per violation keeps the failure readable: rule, impact, count, first target.
  const summary = serious.map(
    (v) =>
      `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
  expect(summary, screen).toEqual([]);
  return results.violations;
};

test("the library, a lesson and its show pass the automated WCAG audit", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await audit(page, "library");
  await page.goto("/#evaluation");
  await expect(
    page.getByRole("heading", { level: 1, name: "Evaluation card" }),
  ).toBeVisible();
  await audit(page, "evaluation card");
  await page.goto("/#about");
  await expect(
    page.getByRole("heading", { level: 1, name: "About ExplainBack" }),
  ).toBeVisible();
  await audit(page, "about page");
  await page.goto("/");
  await page.getByRole("link", { name: /Open lesson.*cooling/i }).click();
  await expect(
    page.getByRole("button", { name: "Disagree", exact: true }),
  ).toBeVisible();
  await audit(page, "lesson predict step");
  await page.getByRole("button", { name: "Disagree", exact: true }).click();
  await page
    .getByRole("button", { name: "Test this claim", exact: false })
    .click();
  await audit(page, "lesson experiment step");
  await page.goto("/#show:cooling");
  await expect(
    page.getByRole("button", { name: /play/i }).first(),
  ).toBeVisible();
  await audit(page, "show player");
});

test("the signed-in studio and the judge path pass the automated WCAG audit", async ({
  page,
}) => {
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await expect(
    page.getByRole("button", { name: "Create a lesson", exact: true }),
  ).toBeVisible();
  await audit(page, "studio create");
  await page
    .getByLabel("What would you like to explore?")
    .fill("Cooling coffee");
  await page
    .getByRole("button", { name: "Create a lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cooling coffee", exact: true }),
  ).toBeVisible();
  await audit(page, "studio draft review");
});
