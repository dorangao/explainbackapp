import { test, expect } from "@playwright/test";

test("the judge path runs the whole creation story in order and reports its cost", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/"))
      requests.push(new URL(r.url()).pathname);
  });
  await page.goto("/#invite:BROWSER-TEST-CODE");
  await expect(
    page.getByRole("heading", { name: "The six-minute tour" }),
  ).toBeVisible();
  await expect(
    page.getByText("Requests the remaining steps will make: 4"),
  ).toBeVisible();
  await page.getByRole("button", { name: /Run all remaining/ }).click();
  await expect(page.getByText(/All steps done/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.judge-steps li[data-state="done"]')).toHaveCount(
    6,
  );
  // The fixture's show writer flags one slide, so the show request draws the cover and
  // that illustration together and the illustration step is already done.
  await expect(page.getByText("Used in this session: 3")).toBeVisible();
  const studio = requests.filter(
    (p) => p.startsWith("/api/studio/") && p !== "/api/studio/session",
  );
  expect(studio).toEqual([
    "/api/studio/compose",
    "/api/studio/tryout",
    "/api/studio/show",
  ]);
  // The saved, shared copy sits on the shelf; a second tour costs nothing.
  await expect(
    page.getByRole("switch", { name: "Shared by link" }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(700);
    console.log(
      "DEBUG probe",
      i,
      await page.evaluate(() => ({
        len: (localStorage.getItem("explainback-studio-draft") ?? "").length,
        keys: Object.keys(localStorage),
        player: !!document.querySelector(".show-player"),
        playing: document.querySelector(
          ".show-player button[aria-label=Pause], .show-player button",
        )?.textContent,
        foot: document.querySelector(".judge-foot")?.textContent,
      })),
    );
  }
  console.log(
    "DEBUG before",
    page.url(),
    await page.evaluate(
      () => (localStorage.getItem("explainback-studio-draft") ?? "").length,
    ),
  );
  await page.reload();
  await page.waitForTimeout(3000);
  console.log(
    "DEBUG after",
    page.url(),
    await page.evaluate(
      () => (localStorage.getItem("explainback-studio-draft") ?? "").length,
    ),
    await page.evaluate(() => ({
      states: [...document.querySelectorAll(".judge-steps li")]
        .map((e) => e.getAttribute("data-state"))
        .join(","),
      foot: document.querySelector(".judge-foot")?.textContent,
      saved: !!document.querySelector(".saved-bar"),
    })),
  );
  await expect(page.getByText(/All steps done/)).toBeVisible({
    timeout: 15_000,
  });
  // Leave the fixture as it was found: the tour's saved, shared copy is removed.
  await page.getByRole("button", { name: "Start a new lesson" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByText(/Nothing saved yet/)).toBeVisible();
});
