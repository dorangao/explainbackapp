import { test, expect } from "@playwright/test";

// The service worker would answer fetches itself and hide them from the page's request
// events; block it so the request order can be checked.
test.use({ serviceWorkers: "block" });

// Search first: the fixture's ground step returns one sourced figure, the fixture draft
// names its page, and both appear under Sources in the review and in the player.
test("search first grounds a draft on a sourced figure and the lesson lists its page", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/studio/"))
      requests.push(new URL(r.url()).pathname);
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  const question = page.getByLabel("What would you like to explore?");
  await expect(question).toBeVisible();
  await question.fill("Boiling water");
  await page.getByRole("checkbox", { name: /Search first/ }).check();
  await expect(page.getByText(/Search first adds one request/)).toBeVisible();
  await page
    .getByRole("button", { name: "Create a lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cooling coffee", exact: true }),
  ).toBeVisible();
  // Request events can arrive a beat after the reply has rendered; poll for the order.
  await expect
    .poll(() => requests)
    .toEqual([
      "/api/studio/session",
      "/api/studio/ground",
      "/api/studio/compose",
    ]);
  await expect(
    page.getByText(/Grounded on one sourced figure as of 2026-10-31/),
  ).toBeVisible();
  const sources = page.locator(".references");
  await expect(sources).toContainText("gathered by a web search on 2026-10-31");
  await expect(sources).toContainText("Water boils at 100 °C at sea level.");
  await expect(
    sources.getByRole("link", { name: "Boiling point reference" }),
  ).toHaveCount(2);
  await expect(
    sources.getByRole("link", { name: "Boiling point reference" }).first(),
  ).toHaveAttribute("href", "https://example.org/boiling-point");
  // The player shows the lesson's sources under its assumptions.
  await page
    .getByLabel(
      "I reviewed the demo definition and its assumptions for this presentation.",
    )
    .check();
  await page
    .getByRole("button", { name: "Present this lesson →", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Agree", exact: true }),
  ).toBeVisible();
  // Assumptions are collapsed until the experiment starts; open them to read the sources.
  await page.getByText("Assumptions & limits", { exact: true }).click();
  await expect(
    page
      .locator(".assumptions")
      .getByRole("link", { name: "Boiling point reference" }),
  ).toHaveAttribute("href", "https://example.org/boiling-point");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});
