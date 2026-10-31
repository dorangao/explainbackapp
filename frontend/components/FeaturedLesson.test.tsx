import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FeaturedLesson } from "./Gallery";
import { galleryShow } from "../lib/shared";

afterEach(cleanup);

describe("FeaturedLesson", () => {
  it("presents the how-to lesson as the 6-step tour with its show cover, a play-through link and the lesson link", () => {
    render(<FeaturedLesson language="en" id="explainback" />);
    expect(screen.getByText("The 6-step tour")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "How ExplainBack makes a lesson" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: "Play the tour: How ExplainBack makes a lesson",
        })
        .getAttribute("href"),
    ).toBe("#show:explainback/play");
    expect(
      screen
        .getByRole("link", {
          name: "Start here: How ExplainBack makes a lesson",
        })
        .getAttribute("href"),
    ).toBe("#lesson:explainback");
    // The card's picture is the show's cover illustration, not the shared line art.
    expect(
      document.querySelector(".featured-card img")?.getAttribute("src"),
    ).toBe(galleryShow("explainback")?.cover);
    cleanup();
    render(<FeaturedLesson language="zh" id="explainback" />);
    expect(screen.getByText("六步导览")).toBeTruthy();
    expect(screen.getByRole("link", { name: /播放导览/ })).toBeTruthy();
  });
  it("renders nothing for an unknown lesson", () => {
    const { container } = render(<FeaturedLesson language="en" id="nope" />);
    expect(container.innerHTML).toBe("");
  });
});
