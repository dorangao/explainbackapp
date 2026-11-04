import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { coolingLesson } from "../test-support/generated-lessons.mjs";

test.use({ serviceWorkers: "block" });
for (const [width, language, mode] of [
  [320, "en", "dark"],
  [390, "en", "dark"],
  [390, "zh", "light"],
  [1280, "en", "light"],
] as const) {
  test(`created show controls stay compact and usable at ${width}px in ${language} ${mode}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(
      ({ mode }) => {
        localStorage.setItem(
          "explainback-appearance",
          JSON.stringify({ version: 1, theme: "paper", mode }),
        );
        // Exercise the long system-voice names seen on phones without speaking audio.
        const voices = [
          {
            name: "Samantha (Enhanced, United States)",
            voiceURI: "samantha",
            lang: "en-US",
          },
          { name: "Alex", voiceURI: "alex", lang: "en-US" },
          { name: "Tingting (Enhanced)", voiceURI: "tingting", lang: "zh-CN" },
          { name: "Sinji", voiceURI: "sinji", lang: "zh-HK" },
        ];
        Object.defineProperty(window, "SpeechSynthesisUtterance", {
          configurable: true,
          value: class {
            text: string;
            lang = "";
            rate = 1;
            voice: unknown = null;
            constructor(text: string) {
              this.text = text;
            }
          },
        });
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: {
            getVoices: () => voices,
            speak() {},
            cancel() {},
            addEventListener() {},
            removeEventListener() {},
          },
        });
      },
      { mode },
    );
    await page.route("**/api/studio/show", async (route) => {
      const response = await route.fetch(),
        data = await response.json();
      await route.fulfill({
        response,
        json: { ...data, cover: "/gallery/cooling-cover.webp" },
      });
    });
    await page.goto("/#invite:BROWSER-TEST-CODE");
    await page.getByLabel("Import lesson JSON").setInputFiles({
      name: "lesson.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(coolingLesson())),
    });
    await page.getByRole("button", { name: "Make a narrated show" }).click();
    const player = page.locator(".show-player");
    await expect(player.locator(".show-cover img")).toBeVisible();
    if (language === "zh") {
      if (!(await page.getByLabel("Language / 语言").isVisible()))
        await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByLabel("Language / 语言").selectOption("zh");
      const menu = page.locator(".menu-button");
      if ((await menu.getAttribute("aria-expanded")) === "true")
        await menu.click();
    }
    await expect(page.locator("html")).toHaveCSS("color-scheme", mode);
    const settings = player.locator(".show-settings"),
      summary = settings.locator("summary");
    await expect(settings).not.toHaveAttribute("open", "");
    const controls = await player.locator(".show-controls").boundingBox();
    expect(controls!.height).toBeLessThanOrEqual(120);
    const row = await player.locator(".show-transport").boundingBox();
    for (const button of await player.locator(".show-transport button").all()) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(row!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(row!.x + row!.width + 1);
    }
    const positionControls = () =>
      page.evaluate(() => {
        const controls = document.querySelector(".show-controls")!;
        const header = document.querySelector(".create-workspace-header");
        window.scrollTo({
          top:
            controls.getBoundingClientRect().top +
            scrollY -
            (header?.getBoundingClientRect().height ?? 0) -
            24,
          behavior: "instant",
        });
      });
    await positionControls();
    await page.screenshot({
      path: `output/playwright/show-controls-${width}-${language}-${mode}.png`,
    });
    await summary.click();
    await expect(settings).toHaveAttribute("open", "");
    const pace = player.getByRole("combobox", {
      name: language === "en" ? "Pace" : "节奏",
      exact: true,
    });
    await expect(pace).toBeVisible();
    await pace.selectOption("slow");
    await pace.press("ArrowRight");
    await expect(player.locator(".show-counter")).toHaveText("1 / 4");
    await expect(
      player.getByLabel(language === "en" ? "Narration voice" : "朗读声音", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .include(".show-controls")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await positionControls();
    await page.screenshot({
      path: `output/playwright/show-settings-${width}-${language}-${mode}.png`,
    });
    await summary.click();
    await expect(pace).not.toBeVisible();
    const play = player.getByRole("button", {
      name: language === "en" ? "Play" : "播放",
      exact: true,
    });
    await play.click();
    await player
      .getByRole("button", {
        name: language === "en" ? "Pause" : "暂停",
        exact: true,
      })
      .click();
    await player
      .getByRole("button", {
        name: language === "en" ? "Next slide" : "下一张",
        exact: true,
      })
      .click();
    await expect(player.locator(".show-counter")).toHaveText("2 / 4");
    await player
      .getByRole("button", {
        name: language === "en" ? "Close show" : "关闭讲解秀",
        exact: true,
      })
      .click();
    await expect(player).toHaveCount(0);
  });
}
