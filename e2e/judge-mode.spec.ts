import { test, expect, type Page, type Route } from "@playwright/test";
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
  const tally = page.locator(".judge-foot");
  await expect(tally).toContainText("Used in this session: 0");
  const restart = banner.getByRole("button", {
    name: "New judge session",
    exact: true,
  });
  await expect(restart).toHaveCount(0);
  await banner.screenshot({
    path: "output/playwright/judge-session-active.png",
  });
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
  await expect(
    page.getByText("49 / 50 AI calls left in this Judge session", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(banner).toContainText("49/50 AI calls left");
  await page
    .getByText("Guided creation · the 6-step tour", { exact: true })
    .click();
  await expect(tally).toContainText("Used in this session: 1");
  const reloaded = await page.request.get("/api/status").then((r) => r.json());
  expect(reloaded.access.expiresAt).toBe(initial.access.expiresAt);
  await expect(restart).toHaveCount(0);
  // Drive the browser's last-call boundary without spending real provider calls.
  await page.route("**/api/status", async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    data.access.remaining = 0;
    await route.fulfill({ response, json: data });
  });
  await page.reload();
  await expect(banner).toContainText("0/50 AI calls left");
  await expect(
    page.getByRole("button", {
      name: "Start a new provider session",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByText(/hourly request budget/)).toHaveCount(0);
  await banner.screenshot({
    path: "output/playwright/judge-session-exhausted.png",
  });
  await restart.click();
  await page.unroute("**/api/status");
  await completeCheck(page);
  await page
    .getByRole("button", { name: "Start Judge mode", exact: true })
    .click();
  await expect(banner).toContainText("50/50 AI calls left");
  await expect(tally).toContainText("Used in this session: 0");
  await expect(restart).toHaveCount(0);
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
  await expect(banner).toContainText("This judge session has expired.");
  await banner.screenshot({
    path: "output/playwright/judge-session-expired.png",
  });
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("What would you like to explore?")).toHaveCount(
    0,
  );
  await restart.click();
  await page.unroute("**/api/status");
  await completeCheck(page);
  await page
    .getByRole("button", { name: "Start Judge mode", exact: true })
    .click();
  await expect(banner).toContainText("50/50 AI calls left");
  await expect(tally).toContainText("Used in this session: 0");
  await expect(restart).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(banner).toHaveCount(0);
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

for (const phone of [false, true]) {
  test(`Judge entry focuses the delayed quick check on ${phone ? "phone" : "desktop"}`, async ({
    page,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    // Focus-only cases control delivery without consuming the fixture server's
    // per-network quick-check quota. The login flow above uses real challenges.
    const deliverCheck = (route: Route) =>
      route.fulfill({
        json: {
          id: "synthetic-focus-check",
          expiresAt: Date.now() + 300000,
          ...(route.request().postDataJSON().kind === "text"
            ? { kind: "text", left: 2, right: 3 }
            : {
                kind: "image",
                image:
                  "data:image/svg+xml;base64," +
                  Buffer.from(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="88"><text x="20" y="50">12345</text></svg>',
                  ).toString("base64"),
              }),
        },
      });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/judge-challenge", async (route) => {
      await pending;
      await deliverCheck(route);
    });
    await page.goto("/");
    if (phone)
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Judge mode", exact: true }).click();
    await expect(
      page.getByText("Preparing a quick check…", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Reviewer access code", { exact: true }),
    ).not.toBeFocused();
    await expect(page.locator(".judge-check")).toBeFocused();
    release();
    await expect(
      page.getByLabel("Enter the five digits", { exact: true }),
    ).toBeFocused();
    await page.unroute("**/api/judge-challenge");
    await page.route("**/api/judge-challenge", deliverCheck);
    await page
      .getByRole("button", { name: "Use a text check", exact: true })
      .click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeFocused();
    if (phone)
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Sign in", exact: true })
      .first()
      .click();
    await expect(
      page.getByLabel("Reviewer access code", { exact: true }),
    ).toBeFocused();
    if (phone)
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Judge mode", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeFocused();
    let releaseNext!: () => void;
    const nextPending = new Promise<void>((resolve) => {
      releaseNext = resolve;
    });
    await page.unroute("**/api/judge-challenge");
    await page.route("**/api/judge-challenge", async (route) => {
      await nextPending;
      await deliverCheck(route);
    });
    await page.getByRole("button", { name: "New image", exact: true }).click();
    await page.getByLabel("Reviewer access code", { exact: true }).click();
    releaseNext();
    await expect(
      page.getByLabel("Enter the five digits", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Reviewer access code", { exact: true }),
    ).toBeFocused();
  });
}
