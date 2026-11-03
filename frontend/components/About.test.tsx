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
  it("step three says code checks the transfer answer and a model assesses the explanation only with creation access", () => {
    const stepThree = () =>
      document.querySelectorAll(".about-steps li")[2]?.textContent ?? "";
    render(<About language="en" />);
    expect(stepThree()).toMatch(/Code checks the transfer answer/);
    expect(stepThree()).toMatch(
      /With creation access, a model assesses your explanation against the computed result and asks one follow-up question/,
    );
    expect(stepThree()).not.toMatch(/only comments on the wording|verif/);
    cleanup();
    render(<About language="zh" />);
    expect(stepThree()).toMatch(/迁移题的答案由代码检查/);
    expect(stepThree()).toMatch(
      /拥有创作权限时，模型会对照计算结果评价你的解释，并提出一个追问/,
    );
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
