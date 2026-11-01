import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { About } from "./About";
import { PageHeader } from "./PageHeader";

afterEach(cleanup);

describe("About page and the shared page header", () => {
  it("renders one h1 under a crumb trail, four sections and the evaluation and source links", () => {
    render(<About language="en" />);
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "About ExplainBack" }),
    ).toBeTruthy();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs.querySelector('a[href="#studio"]')?.textContent).toBe(
      "Library",
    );
    expect(crumbs.querySelector('[aria-current="page"]')?.textContent).toBe(
      "About",
    );
    for (const name of [
      "How it works",
      "How evaluation works",
      "Limits and privacy",
      "Source",
    ])
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Evaluation card/ })
        .getAttribute("href"),
    ).toBe("#evaluation");
    expect(
      screen
        .getByRole("link", { name: "Source on GitHub" })
        .getAttribute("href"),
    ).toBe("https://github.com/dorangao/explainbackapp");
    cleanup();
    render(<About language="zh" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "关于 ExplainBack" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "限制与隐私" }),
    ).toBeTruthy();
  });
  it("page header shows eyebrow, meta and actions when given", () => {
    render(
      <PageHeader
        language="en"
        crumbs={[
          { label: "Library", href: "#studio" },
          { label: "Newton cooling" },
        ]}
        eyebrow="Chapter 1 / 1"
        title="Newton cooling"
        meta="Adjustable model · Reviewed by the author"
        actions={<button type="button">Watch the show</button>}
      />,
    );
    expect(screen.getByText("Chapter 1 / 1")).toBeTruthy();
    expect(
      screen.getByText("Adjustable model · Reviewed by the author"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Watch the show" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Newton cooling" }),
    ).toBeTruthy();
  });
});
