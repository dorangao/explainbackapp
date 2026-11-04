import { test, expect } from "@playwright/test";

for (const width of [320, 1440]) {
  test(`menu calculator preserves the lesson and supports keyboard and touch at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await page.goto("/#lesson:cooling");
    if (width < 720)
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    const trigger = page
      .locator(".header-tools")
      .getByRole("button", { name: "Calculator", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Calculator",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    const expression = dialog.getByRole("textbox", {
      name: "Expression",
      exact: true,
    });
    await expression.fill("sqrt(81)+log(100)");
    await expression.press("Enter");
    await expect(
      dialog.getByLabel("Calculator result", { exact: true }),
    ).toHaveValue("11");
    await expect(
      dialog.getByRole("button", { name: /Use result/ }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
      )
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator(".lesson-player")).toHaveAttribute(
      "data-stage",
      "predict",
    );
    await trigger.click();
    await expect(expression).toHaveValue("sqrt(81)+log(100)");
    await dialog.getByRole("button", { name: "Clear calculator" }).click();
    for (const key of ["7", "×", "4"])
      await dialog.getByRole("button", { name: key, exact: true }).click();
    await dialog
      .getByRole("button", { name: "Calculate", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Calculator result", { exact: true }),
    ).toHaveValue("28");
    await dialog
      .getByRole("button", { name: "Close calculator", exact: true })
      .click();
    await page.getByLabel("Language / 语言").selectOption("zh");
    await page
      .locator(".header-tools")
      .getByRole("button", { name: "计算器", exact: true })
      .click();
    const chinese = page.getByRole("dialog", { name: "计算器", exact: true });
    await expect(chinese.getByLabel("计算器结果", { exact: true })).toHaveValue(
      "28",
    );
    await chinese
      .getByRole("button", { name: "关闭计算器", exact: true })
      .click();
    expect(posts).toEqual([]);
  });
}

test("fresh-case calculator fills an answer explicitly and Enter never grades it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/#lesson:cooling");
  await page.getByRole("button", { name: "Not sure", exact: true }).click();
  await page.getByRole("button", { name: /Test this claim/ }).click();
  await page
    .getByRole("button", { name: "Show final state", exact: true })
    .click();
  await page.getByRole("button", { name: /Explain the result/ }).click();
  await page.getByRole("button", { name: /Try a fresh case/ }).click();
  const calculator = page.locator(".transfer-question .calculator");
  await calculator.locator("summary").click();
  await calculator
    .getByLabel("Expression", { exact: true })
    .fill("15+75*exp(-0.5)");
  await calculator.getByLabel("Expression", { exact: true }).press("Enter");
  await expect(
    calculator.getByLabel("Calculator result", { exact: true }),
  ).toHaveValue("60.48979947844751");
  await expect(
    page.getByRole("button", { name: /Finish lesson/ }),
  ).toBeDisabled();
  const answer = page.getByRole("textbox", {
    name: "Your answer (°C)",
    exact: true,
  });
  await expect(answer).toHaveValue("");
  await calculator
    .getByRole("button", { name: "Use result (°C)", exact: true })
    .click();
  await expect(answer).toHaveValue("60.48979947844751");
  await expect(answer).toBeFocused();
  await expect(
    page.getByRole("button", { name: /Finish lesson/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Check answer locally", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Finish lesson/ }),
  ).toBeEnabled();
  expect(posts).toEqual([]);
});
