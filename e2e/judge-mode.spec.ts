import { test, expect, type Page } from "@playwright/test";
async function completeCheck(page: Page) {
  await page
    .getByRole("button", { name: "Use a text check", exact: true })
    .click();
  const question = page.getByText(/^What is \d+ \+ \d+\?$/);
  await expect(question).toBeVisible();
  const values = (await question.innerText()).match(/\d+/g)!.map(Number);
  await page
    .getByLabel("Your answer", { exact: true })
    .fill(String(values[0] + values[1]));
}
test("a public judge can create, reload and restart; only the admin sees usage", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Judge mode", exact: true }).click();
  await expect(
    page.getByText(/No account or invite code needed/),
  ).toBeVisible();
  await completeCheck(page);
  await page
    .getByRole("button", { name: "Start Judge mode", exact: true })
    .click();
  const banner = page.getByRole("region", { name: "Judge session" });
  await expect(banner).toContainText("50/50 AI calls left");
  await expect(
    page.getByRole("button", { name: "Judge usage", exact: true }),
  ).toHaveCount(0);
  const initial = await page.request.get("/api/status").then((r) => r.json());
  await page
    .getByLabel("What would you like to explore?")
    .fill("Cooling coffee");
  await page
    .getByRole("button", { name: "Create a lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cooling coffee", exact: true }),
  ).toBeVisible();
  await expect(banner).toContainText("49/50 AI calls left");
  await page.reload();
  await expect(banner).toContainText("49/50 AI calls left");
  const reloaded = await page.request.get("/api/status").then((r) => r.json());
  expect(reloaded.access.expiresAt).toBe(initial.access.expiresAt);
  await banner.getByRole("button", { name: "New judge session" }).click();
  await completeCheck(page);
  await page
    .getByRole("button", { name: "Start Judge mode", exact: true })
    .click();
  await expect(banner).toContainText("50/50 AI calls left");
  await expect(
    page.getByLabel("What would you like to explore?"),
  ).toBeVisible();
  const restarted = await page.request.get("/api/status").then((r) => r.json());
  expect(restarted.access.label).not.toBe(initial.access.label);
  expect((await page.request.get("/api/admin/judge-usage")).status()).toBe(403);
  // Exercise the UI expiry boundary without waiting half an hour. Server expiry has
  // separate clock-controlled store and in-flight HTTP coverage.
  await page.route("**/api/status", async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    data.access.expiresAt = Date.now() + 500;
    await route.fulfill({ response, json: data });
  });
  await page.reload();
  await expect(banner).toHaveCount(0);
  await expect(
    page.getByText("Your session ended. Reviewed lessons remain available."),
  ).toBeVisible();
  await page.unroute("**/api/status");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page
    .getByText("Administrator sign-in (tester account)", { exact: true })
    .click();
  await page.getByLabel("Username", { exact: true }).fill("browser-tester");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic-browser-password");
  await page
    .locator(".access-panel")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page.getByRole("button", { name: "Judge usage", exact: true }).click();
  const usage = page.getByRole("region", { name: "Judge usage" });
  await expect(usage).toContainText("AI calls today");
  await expect(
    usage.getByText(initial.access.label, { exact: true }),
  ).toBeVisible();
  await expect(
    usage.getByText(restarted.access.label, { exact: true }),
  ).toBeVisible();
  await expect(
    usage.getByRole("cell", { name: "1 / 50", exact: true }),
  ).toBeVisible();
  await usage.getByRole("button", { name: "Reset daily allowance" }).click();
  const confirm = usage.getByRole("button", {
    name: "Confirm reset",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await usage.getByLabel("Reason for reset").fill("Browser reset verification");
  await expect(confirm).toBeDisabled();
  await usage.getByLabel("I confirm this reset").check();
  await confirm.click();
  await expect(usage.getByText("0 / 500", { exact: true })).toBeVisible();
  await expect(
    usage.getByText(/Total provider calls today: 1\./),
  ).toBeVisible();
  await usage.getByText("Administrator reset history", { exact: true }).click();
  await expect(usage.getByText(/Browser reset verification/)).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(usage).toHaveCount(0);
});
