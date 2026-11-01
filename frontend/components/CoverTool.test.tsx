import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CoverTool } from "./CoverTool";
import { resetCovers } from "../lib/covers";

vi.mock("../lib/library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/library")>()),
  listCovers: async () => ({
    covers: {
      cooling: {
        src: "https://store.example/covers/cooling-creator.webp",
        model: "muse-image-1.0",
        createdAt: "2026-10-31",
        promptVersion: "cover-v1",
      },
    },
  }),
}));

afterEach(() => {
  cleanup();
  resetCovers();
});

describe("CoverTool", () => {
  it("shows the creator-drawn cover over the shipped one, draws a new one on request and says the library shows it", async () => {
    const onDraw = vi.fn(async () => ({
      lessonId: "cooling",
      cover: "https://store.example/covers/cooling-new.webp",
      model: "muse-image-1.0",
      createdAt: "2026-11-01",
      promptVersion: "cover-v1",
      attemptsRemaining: 6,
    }));
    const { container } = render(
      <CoverTool
        language="en"
        lessonId="cooling"
        busy={false}
        onDraw={onDraw}
      />,
    );
    await screen.findByText(/Current cover: muse-image-1\.0 · 2026-10-31/);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://store.example/covers/cooling-creator.webp",
    );
    fireEvent.click(screen.getByRole("button", { name: "Redraw the cover" }));
    expect(onDraw).toHaveBeenCalledTimes(1);
    await screen.findByText(/New cover drawn/);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://store.example/covers/cooling-new.webp",
    );
    expect(screen.getByText(/muse-image-1\.0 · 2026-11-01/)).toBeTruthy();
  });
  it("falls back to the shipped cover and offers to draw one for a lesson that has none", async () => {
    render(
      <CoverTool
        language="zh"
        lessonId="eval-projectile-wonder"
        busy={false}
        onDraw={async () => null}
      />,
    );
    // The evaluation showcase lesson ships with a cover from the manifest.
    expect(await screen.findByText(/当前封面：\s*随应用附带/)).toBeTruthy();
    cleanup();
    render(
      <CoverTool
        language="en"
        lessonId="no-such-lesson"
        busy={true}
        onDraw={async () => null}
      />,
    );
    expect(await screen.findByText("No cover")).toBeTruthy();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole("button").textContent).toMatch(/drawing/);
  });
});

describe("CoverTool for a saved lesson", () => {
  it("shows the saved lesson's own cover and draws one onto the record without touching the library overrides", async () => {
    const onDraw = vi.fn(async () => ({
      savedId: "0123456789abcdef",
      cover: "https://store.example/images/own.webp",
      model: "muse-image-1.0",
      createdAt: "2026-11-01",
      promptVersion: "cover-v1",
      attemptsRemaining: 6,
    }));
    const { container } = render(
      <CoverTool
        language="en"
        saved={{ cover: null, coverModel: null }}
        busy={false}
        onDraw={onDraw}
      />,
    );
    expect(screen.getByText(/no cover yet/)).toBeTruthy();
    expect(screen.getByText(/Your lesson's card shows it/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Draw a cover" }));
    await screen.findByText(/New cover drawn/);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://store.example/images/own.webp",
    );
    expect(screen.getByText(/muse-image-1\.0 · 2026-11-01/)).toBeTruthy();
  });
  it("names the narrated show as the source of a saved show cover", () => {
    render(
      <CoverTool
        language="en"
        saved={{
          cover: "https://store.example/images/show.webp",
          coverModel: null,
        }}
        busy={false}
        onDraw={vi.fn(async () => null)}
      />,
    );
    expect(
      screen.getByText(/Current cover: from the narrated show\./),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Redraw the cover" }),
    ).toBeTruthy();
  });
});
