import { test, expect } from "@playwright/test";
import { coolingLesson } from "../test-support/generated-lessons.mjs";

for (const width of [1280, 390]) {
  test(`Create and Tryout keep progress and have clear exits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/studio/"))
        modelRequests.push(request.url());
    });
    await page.goto("/#invite:BROWSER-TEST-CODE");
    await page.getByLabel("Import lesson JSON").setInputFiles({
      name: "lesson.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(coolingLesson())),
    });
    await page.getByRole("checkbox", { name: /I reviewed/ }).check();
    await page.getByRole("tab", { name: "Tryout", exact: true }).click();
    await page.getByRole("button", { name: "Agree", exact: true }).click();
    await page.getByRole("button", { name: /Test this claim/ }).click();
    await page
      .getByRole("button", { name: "Show final state", exact: true })
      .click();
    await page.getByRole("button", { name: /Explain the result/ }).click();
    await page.getByRole("button", { name: /Try a fresh case/ }).click();
    await page.getByRole("textbox", { name: /Your answer/ }).fill("42");
    await page.getByRole("tab", { name: "Create", exact: true }).click();
    await page
      .getByRole("button", { name: "Create home", exact: true })
      .click();
    await expect(
      page.getByLabel("What would you like to explore?"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue tryout" }).click();
    await expect(
      page.getByRole("textbox", { name: /Your answer/ }),
    ).toHaveValue("42");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("explainback-studio-draft") ?? "{}")
              .tryoutUI?.answer,
        ),
      )
      .toBe("42");
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: /Your answer/ }),
    ).toHaveValue("42");
    await page.getByRole("button", { name: "New lesson", exact: true }).click();
    await expect(
      page.getByLabel("What would you like to explore?"),
    ).toHaveValue("");
    await page
      .getByLabel("What would you like to explore?")
      .fill("Another question");
    await page
      .getByRole("button", { name: "Create a lesson", exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(
      page.getByRole("tab", { name: "Create", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page
      .getByRole("tab", { name: "Create", exact: true })
      .press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Tryout", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("textbox", { name: /Your answer/ }),
    ).toHaveValue("42");
    expect(modelRequests).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
}
