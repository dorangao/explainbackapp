import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, slugify } from "./markdown";

describe("markdown reader", () => {
  it("reads headings, paragraphs, lists, tables and code into blocks", () => {
    const blocks = parseMarkdown(
      [
        "# Title here",
        "",
        "A paragraph that",
        "wraps onto a second line.",
        "",
        "## Results",
        "",
        "| Model | Score |",
        "|---|---|",
        "| `wonder` | 9 / 10 |",
        "| spark | **8** / 10 |",
        "",
        "- first item",
        "- second item",
        "",
        "1. one",
        "2. two",
        "",
        "```sh",
        "npm run eval",
        "```",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "table",
      "list",
      "list",
      "code",
    ]);
    const [title, paragraph, , table, bullets, numbers, code] = blocks;
    expect(title).toMatchObject({ level: 1, id: "title-here" });
    expect(paragraph).toMatchObject({
      children: [
        { kind: "text", text: "A paragraph that wraps onto a second line." },
      ],
    });
    expect(table).toMatchObject({
      header: [
        [{ kind: "text", text: "Model" }],
        [{ kind: "text", text: "Score" }],
      ],
      rows: [
        [
          [{ kind: "code", text: "wonder" }],
          [{ kind: "text", text: "9 / 10" }],
        ],
        [
          [{ kind: "text", text: "spark" }],
          [
            { kind: "strong", children: [{ kind: "text", text: "8" }] },
            { kind: "text", text: " / 10" },
          ],
        ],
      ],
    });
    expect(bullets).toMatchObject({
      ordered: false,
      items: [[{ text: "first item" }], [{ text: "second item" }]],
    });
    expect(numbers).toMatchObject({
      ordered: true,
      items: [[{ text: "one" }], [{ text: "two" }]],
    });
    expect(code).toEqual({
      kind: "code",
      text: "npm run eval",
      language: "sh",
    });
  });
  it("resolves relative links against the published folder and marks external ones", () => {
    const nodes = parseInline(
      "See [the report](evaluation/report.md), [a section](#results) and [the site](https://explainback.app).",
      "https://github.com/dorangao/explainbackapp/blob/main/docs/",
    );
    const links = nodes.filter((n) => n.kind === "link");
    expect(links.map((l) => l.kind === "link" && [l.href, l.external])).toEqual(
      [
        [
          "https://github.com/dorangao/explainbackapp/blob/main/docs/evaluation/report.md",
          true,
        ],
        ["#results", false],
        ["https://explainback.app", true],
      ],
    );
  });
  it("slugifies heading text the way in-page anchors expect", () => {
    expect(slugify("studio-breadth-v1, October 31, 2026")).toBe(
      "studio-breadth-v1-october-31-2026",
    );
    expect(slugify("What these numbers do not establish")).toBe(
      "what-these-numbers-do-not-establish",
    );
  });
});
