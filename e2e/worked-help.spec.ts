import { test, expect } from "@playwright/test";

for (const language of ["en", "zh"]) {
  test(`worked help explains the current cooling case and keeps completion assisted (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: language === "zh" ? 390 : 1440,
      height: 844,
    });
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await page.goto("/#lesson:cooling");
    await page.getByRole("button", { name: "Not sure", exact: true }).click();
    await page.getByRole("button", { name: /Test this claim/ }).click();
    await page.getByRole("button", { name: "Show final state" }).click();
    await page.getByRole("button", { name: /Explain the result/ }).click();
    await page.getByRole("button", { name: /Try a fresh case/ }).click();
    if (language === "zh") {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByLabel("Language / 语言").selectOption("zh");
      await page.getByRole("button", { name: "关闭菜单", exact: true }).click();
    }
    const answer = page.getByRole("textbox", {
      name: language === "zh" ? "你的答案 (°C)" : "Your answer (°C)",
      exact: true,
    });
    const reveal = page.getByRole("button", {
      name:
        language === "zh"
          ? "显示解题步骤和答案"
          : "Show worked steps and answer",
      exact: true,
    });
    await expect(reveal).toHaveCount(0);
    await answer.fill("59.9");
    await page
      .getByRole("button", { name: /Check answer locally|本地核验答案/ })
      .click();
    await expect(page.locator(".worked-transfer-steps")).toHaveCount(0);
    await reveal.click();
    const help = page.locator(".worked-transfer");
    await expect(help.getByRole("heading")).toBeFocused();
    await expect(help.getByRole("heading")).toBeInViewport();
    await expect(help).toContainText("90");
    await expect(help).toContainText("15");
    await expect(help).toContainText("0.05");
    await expect(help).toContainText("exp(");
    await expect(help).toContainText("60.48979947844751 °C");
    await expect(help).toContainText(
      language === "zh" ? "四舍五入的答案: 60.5 °C" : "Rounded answer: 60.5 °C",
    );
    await expect(answer).toHaveValue("59.9");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const finish = page.getByRole("button", { name: /Finish lesson|完成课程/ });
    await expect(finish).toBeDisabled();
    await answer.fill("60.5");
    await page
      .getByRole("button", { name: /Check answer locally|本地核验答案/ })
      .click();
    await finish.click();
    await expect(
      page.getByText(
        language === "zh" ? "在帮助下完成" : "Completed with help",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    expect(posts).toEqual([]);
  });
}
