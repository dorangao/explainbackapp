import { test, expect } from "@playwright/test";
import {
  coolingLesson,
  processLesson,
} from "../test-support/generated-lessons.mjs";

test.use({ serviceWorkers: "block" });
for (const [width, kind, language] of [
  [320, "process", "en"],
  [390, "process", "en"],
  [390, "model", "zh"],
  [1280, "model", "en"],
] as const) {
  test(`Explain the result reveals the new section at ${width}px (${kind}, ${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const lesson = kind === "process" ? processLesson() : coolingLesson();
    lesson.title = {
      en: "A longer lesson title that wraps across multiple lines on a phone",
      zh: "在手机上换行显示的长标题：观察实验结果并解释其中的变化",
    };
    await page.goto("/#invite:BROWSER-TEST-CODE");
    await page.getByLabel("Import lesson JSON").setInputFiles({
      name: "lesson.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(lesson)),
    });
    await page.getByRole("checkbox", { name: /I reviewed/ }).check();
    await page.getByRole("tab", { name: "Tryout", exact: true }).click();
    if (language === "zh") {
      if (!(await page.getByLabel("Language / 语言").isVisible()))
        await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByLabel("Language / 语言").selectOption("zh");
      const menu = page.locator(".menu-button");
      if ((await menu.getAttribute("aria-expanded")) === "true")
        await menu.click();
    }
    await page.getByRole("button", { name: /^(Agree|同意)$/ }).click();
    await page
      .getByRole("button", { name: /Test this claim|检验这个观点/ })
      .click();
    await page
      .getByRole("button", { name: /Show final state|查看最终状态/ })
      .click();
    const next = page.getByRole("button", {
      name: /Explain the result|解释结果/,
    });
    await next.click();
    const explanation = page.locator(".evidence-summary");
    await expect(explanation).toBeVisible();
    await expect
      .poll(() =>
        explanation.evaluate((el) => el.contains(document.activeElement)),
      )
      .toBe(true);
    const position = await explanation.evaluate((el) => {
      const heading = el.querySelector("h3") ?? el;
      const header = document.querySelector(".create-workspace-header")!;
      return {
        top: heading.getBoundingClientRect().top,
        headerBottom: header.getBoundingClientRect().bottom,
        inputBottom: el.querySelector("textarea")!.getBoundingClientRect()
          .bottom,
      };
    });
    expect(position.top).toBeGreaterThanOrEqual(position.headerBottom + 8);
    expect(position.top).toBeLessThanOrEqual(position.headerBottom + 24);
    expect(position.inputBottom).toBeLessThan(844);
    // Rendering remembered explanation text must not steal focus or scroll again.
    const answer = explanation.locator("textarea");
    await answer.fill("My explanation of the observed result.");
    await expect(answer).toBeFocused();
    await expect(answer).toHaveValue("My explanation of the observed result.");
    await page.screenshot({
      path: `output/playwright/explain-result-${width}-${language}.png`,
    });
    // Re-enter through the keyboard, exercising another committed stage transition.
    await page
      .getByRole("button", { name: /Replay experiment|重播实验/ })
      .click();
    await page
      .getByRole("button", { name: /Show final state|查看最终状态/ })
      .click();
    await next.focus();
    await next.press("Enter");
    await expect
      .poll(() =>
        explanation.evaluate((el) => el.contains(document.activeElement)),
      )
      .toBe(true);
    const targetTop = await explanation
      .locator("h3")
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(targetTop).toBeGreaterThanOrEqual(position.headerBottom + 8);
    expect(targetTop).toBeLessThanOrEqual(position.headerBottom + 24);
  });
}
