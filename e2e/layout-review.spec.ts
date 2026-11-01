import { test, expect } from "@playwright/test";

test("the desktop comparison summary fills its panel above the model columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 1000 });
  await page.goto("/#compare:logistic-growth-en");
  const summary = page.locator(".compare-overview");
  await expect(summary.getByRole("table")).toBeVisible();
  const panelWidth = await summary.evaluate(
    (panel) => panel.getBoundingClientRect().width,
  );
  const tableWidth = await summary
    .getByRole("table")
    .evaluate((table) => table.getBoundingClientRect().width);
  expect(panelWidth - tableWidth).toBeLessThan(4);
});

test("the fresh case separates new settings from the earlier experiment and still checks answers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#lesson:cooling");
  await page.getByRole("button", { name: "Not sure", exact: true }).click();
  await page.getByRole("button", { name: /Test this claim/ }).click();
  await page
    .getByRole("button", { name: "Show final state", exact: true })
    .click();
  await page.getByRole("button", { name: /Explain the result/ }).click();
  await page.getByRole("button", { name: /Try a fresh case/ }).click();
  await expect(
    page.getByRole("heading", { name: "Try a fresh case", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("img", { name: /Newton cooling explorer/ }),
  ).toBeHidden();
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(page.locator(".transfer-question")).toContainText(
    "Initial temperature = 90 °C",
  );
  await expect(page.locator(".transfer-question")).toContainText(
    "Time = 10 min",
  );
  const answer = page.getByRole("textbox", {
    name: "Your answer (°C)",
    exact: true,
  });
  await answer.fill("22.987");
  await page.getByRole("button", { name: "Check answer locally" }).click();
  await expect(
    page.getByRole("button", { name: /Finish lesson/ }),
  ).toBeDisabled();
  await page
    .getByText("Earlier experiment · reference", { exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: /Newton cooling explorer/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/This result uses the earlier settings/),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Experiment progress" }),
  ).toHaveCount(0);
  await answer.fill("60.49");
  await page.getByRole("button", { name: "Check answer locally" }).click();
  await page.getByRole("button", { name: /Finish lesson/ }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer explanation." }),
  ).toBeVisible();
  await expect(page.getByRole("complementary")).toHaveCount(0);
});

for (const width of [320, 390]) {
  test(`phone entry, comparison and show stay usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const tour = page.getByRole("link", { name: /Play the tour:/ });
    await expect(tour).toBeVisible();
    const tourCard = page.locator(".featured-card");
    const cardHeight = await tourCard.evaluate(
      (card) => card.getBoundingClientRect().height,
    );
    const bodyHeight = await tourCard
      .locator(".lesson-card-body")
      .evaluate((body) => body.getBoundingClientRect().height);
    expect(cardHeight - bodyHeight).toBeLessThan(4);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Predict. Test. Explain. Your own explanation.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Every lesson is an experiment you can argue with/),
    ).toBeVisible();
    await tour.click();
    await expect(
      page.getByRole("button", { name: /Pause|Play/, exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("heading", {
        name: "How ExplainBack makes a lesson",
        exact: true,
      }),
    ).toHaveCount(1);
    await page.goto("/#compare:logistic-growth-en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Compare the two models",
    );
    await expect(
      page.getByRole("rowheader", { name: "Muse Wonder" }),
    ).toBeVisible();
    await expect(
      page.getByRole("rowheader", { name: "Muse Spark" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "AI wording rubric" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Compare the two models" })
        .getByText("Human science review required", { exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText("AI wording rubric · 7/10", { exact: true }),
    ).toBeHidden();
    await page
      .getByText("Lesson and rubric details", { exact: true })
      .nth(1)
      .click();
    await expect(
      page.getByText("AI wording rubric · 7/10", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByLabel("Language / 语言").selectOption("zh");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "比较两个模型",
    );
    await expect(
      page.getByRole("columnheader", { name: "AI 表述评分" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
