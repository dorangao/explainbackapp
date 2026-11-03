import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Post } from "../lib/types";
import type { SavedSummary } from "../lib/library";
import { coolingLesson } from "../../test-support/generated-lessons.mjs";
const summary = (over: Partial<SavedSummary> = {}): SavedSummary => ({
  id: "0123456789abcdef",
  title: { en: "Cooling coffee", zh: "咖啡冷却" },
  intro: { en: "Explore an ideal cooling model.", zh: "探索理想冷却模型。" },
  kind: "model",
  cover: null,
  sketch: null,
  hasShow: true,
  hasTryout: false,
  graded: 0,
  model: "muse-wonder-1.0",
  shared: false,
  createdAt: 1,
  updatedAt: 2,
  ...over,
});
const getJson = vi.fn();
vi.mock("../lib/api", () => ({
  ApiError: class extends Error {},
  getJson: (path: string) => getJson(path),
}));
import { LessonShelf, ShareControls } from "./Library";
import { Gallery } from "./Gallery";
afterEach(() => {
  cleanup();
  getJson.mockReset();
});
it("offers administrator actions on another creator's shared card without calling it theirs", async () => {
  let signedIn = false;
  getJson.mockImplementation(async (path: string) =>
    path === "/api/shared"
      ? { lessons: [summary({ shared: true, canManage: signedIn })] }
      : { covers: {} },
  );
  const view = render(<Gallery language="en" />);
  fireEvent.click(screen.getByRole("button", { name: "Shared" }));
  await screen.findByRole("link", { name: /Open lesson: Cooling coffee/ });
  expect(
    screen.queryByRole("group", { name: "Administrator actions" }),
  ).toBeNull();
  signedIn = true;
  view.rerender(<Gallery language="en" post={vi.fn()} />);
  expect(
    await screen.findByRole("group", { name: "Administrator actions" }),
  ).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Your lesson" })).toBeNull();
});
describe("LessonShelf", () => {
  it("labels the administrator shelf, loads more records and does not offer sharing another creator's private lesson", async () => {
    getJson.mockImplementation(async (path: string) =>
      path === "/api/lessons"
        ? {
            lessons: [summary({ canManage: true })],
            limit: null,
            scope: "all",
            cursor: "50",
          }
        : {
            lessons: [
              summary({ canManage: true }),
              summary({
                id: "fedcba9876543210",
                title: { en: "Another saved lesson", zh: "另一课程" },
                canManage: true,
              }),
            ],
            limit: null,
            scope: "all",
            cursor: null,
          },
    );
    render(
      <LessonShelf
        language="en"
        post={vi.fn()}
        currentId={null}
        busy={false}
        onOpen={vi.fn()}
        onNotice={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Manage all saved lessons" }),
    ).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Private" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load more lessons" }));
    expect(
      await screen.findByRole("heading", { name: "Another saved lesson" }),
    ).toBeTruthy();
    expect(getJson).toHaveBeenCalledWith("/api/lessons?cursor=50");
    expect(
      screen.getAllByRole("heading", { name: "Cooling coffee" }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Load more lessons" }),
    ).toBeNull();
  });
  it("lists saved lessons, opens one without a model call, shares by link and deletes after confirming", async () => {
    const cover = "https://x.public.blob.vercel-storage.com/images/a/b.webp";
    getJson.mockImplementation(async (path: string) =>
      path === "/api/lessons"
        ? { lessons: [summary({ cover })], limit: 50 }
        : { ...summary({ cover }), lesson: coolingLesson(), show: null },
    );
    const posts: { path: string; body: unknown }[] = [];
    const post: Post = async (path, body) => {
      posts.push({ path, body });
      if (path === "/api/lessons/share")
        return summary({
          shared: (body as { shared: boolean }).shared,
        }) as never;
      return { deleted: true } as never;
    };
    const opened = vi.fn(),
      notice = vi.fn(),
      deleted = vi.fn();
    render(
      <LessonShelf
        language="en"
        post={post}
        currentId={null}
        busy={false}
        onOpen={opened}
        onNotice={notice}
        onDeleted={deleted}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Cooling coffee" }),
    ).toBeTruthy();
    expect(screen.getByText("1 / 50")).toBeTruthy();
    expect(document.querySelector(".shelf-thumb")?.getAttribute("src")).toBe(
      cover,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
    expect(opened.mock.calls[0][0].lesson.title.en).toBe("Cooling coffee");
    expect(posts).toHaveLength(0);
    // Sharing is a switch; the link appears only while it is on.
    expect(screen.queryByLabelText("Share link")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Private" }));
    expect(await screen.findByLabelText("Share link")).toBeTruthy();
    expect(posts.at(-1)).toEqual({
      path: "/api/lessons/share",
      body: { id: "0123456789abcdef", shared: true },
    });
    expect(
      (screen.getByLabelText("Share link") as HTMLInputElement).value,
    ).toMatch(/#shared:0123456789abcdef$/);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Keep" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() =>
      expect(deleted).toHaveBeenCalledWith("0123456789abcdef"),
    );
    expect(screen.getByText(/Nothing saved yet/)).toBeTruthy();
  });
  it("explains an empty shelf and offers a retry when the list fails", async () => {
    getJson.mockRejectedValueOnce(new Error("down"));
    getJson.mockResolvedValueOnce({ lessons: [], limit: 50 });
    render(
      <LessonShelf
        language="zh"
        post={async () => ({}) as never}
        currentId={null}
        busy={false}
        onOpen={() => {}}
        onNotice={() => {}}
        onDeleted={() => {}}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "重试" }));
    expect(await screen.findByText(/还没有保存的课程/)).toBeTruthy();
  });
});
describe("ShareControls", () => {
  it("reports a failed toggle without changing the switch", async () => {
    const notice = vi.fn(),
      change = vi.fn();
    render(
      <ShareControls
        language="en"
        post={async () => {
          throw new Error("offline");
        }}
        item={summary()}
        busy={false}
        onChange={change}
        onNotice={notice}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(notice).toHaveBeenCalledWith(
        "That change could not be saved. Try again.",
      ),
    );
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "false",
    );
  });
});
describe("Gallery catalog", () => {
  it("defaults to eight lessons and resets to page one when the page size changes", async () => {
    getJson.mockImplementation(async (path: string) =>
      path === "/api/shared" ? { lessons: [], cursor: null } : { covers: {} },
    );
    render(<Gallery language="en" />);
    await screen.findByText("23 lessons");
    const size = screen.getByRole("combobox", { name: "Lessons per page" });
    expect(
      screen.getByRole("button", {
        name: "Sort order unavailable in default order",
      }),
    ).toHaveProperty("disabled", true);
    const help = screen.getByLabelText("About sorting and page size");
    fireEvent.click(help);
    expect(help.closest("details")).toHaveProperty("open", true);
    expect(
      screen.getByText(/Lessons without a recorded date appear last/),
    ).toBeTruthy();
    expect(size).toHaveProperty("value", "8");
    expect(document.querySelectorAll(".gallery-grid article").length).toBe(8);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    fireEvent.change(size, { target: { value: "24" } });
    expect(document.querySelectorAll(".gallery-grid article").length).toBe(23);
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    fireEvent.change(size, { target: { value: "48" } });
    expect(document.querySelectorAll(".gallery-grid article").length).toBe(23);
    fireEvent.change(size, { target: { value: "8" } });
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
  });
  it("sorts titles, creation dates and update dates in both directions, leaving undated lessons last", async () => {
    getJson.mockImplementation(async (path: string) =>
      path === "/api/shared"
        ? {
            lessons: [
              summary({
                id: "1111111111111111",
                title: { en: "Zulu", zh: "第三课" },
                createdAt: 30,
                updatedAt: 10,
              }),
              summary({
                id: "2222222222222222",
                title: { en: "Alpha", zh: "第一课" },
                createdAt: 10,
                updatedAt: 30,
              }),
              summary({
                id: "3333333333333333",
                title: { en: "Beta", zh: "第二课" },
                createdAt: 20,
                updatedAt: 20,
              }),
            ],
            cursor: null,
          }
        : { covers: {} },
    );
    render(<Gallery language="en" />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Lessons per page" }),
      { target: { value: "48" } },
    );
    await screen.findByRole("heading", { name: "Zulu" });
    const titles = () =>
      Array.from(document.querySelectorAll(".gallery-grid h3")).map(
        (h) => h.textContent,
      );
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "created" },
    });
    expect(titles().slice(0, 3)).toEqual(["Zulu", "Beta", "Alpha"]);
    expect(
      screen
        .getByRole("heading", { name: "Zulu" })
        .closest("article")
        ?.querySelector(".lesson-meta")?.textContent,
    ).toContain("Created");
    fireEvent.click(
      screen.getByRole("button", { name: /Sort order: Newest first/ }),
    );
    expect(titles().slice(0, 3)).toEqual(["Alpha", "Beta", "Zulu"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "updated" },
    });
    expect(titles().slice(0, 3)).toEqual(["Alpha", "Beta", "Zulu"]);
    expect(
      screen
        .getByRole("heading", { name: "Zulu" })
        .closest("article")
        ?.querySelector(".lesson-meta")?.textContent,
    ).toContain("Updated");
    fireEvent.click(screen.getByRole("button", { name: "Shared" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "title" },
    });
    expect(titles()).toEqual(["Alpha", "Beta", "Zulu"]);
    fireEvent.click(screen.getByRole("button", { name: /Sort order: A to Z/ }));
    expect(titles()).toEqual(["Zulu", "Beta", "Alpha"]);
  });
  it("offers localized sorting and orders the displayed Chinese titles", async () => {
    getJson.mockImplementation(async (path: string) =>
      path === "/api/shared"
        ? {
            lessons: [
              summary({
                id: "1111111111111111",
                title: { en: "Banana", zh: "香蕉" },
              }),
              summary({
                id: "2222222222222222",
                title: { en: "Apple", zh: "苹果" },
              }),
            ],
            cursor: null,
          }
        : { covers: {} },
    );
    render(<Gallery language="zh" />);
    fireEvent.change(screen.getByRole("combobox", { name: "每页课程数" }), {
      target: { value: "48" },
    });
    await screen.findByRole("heading", { name: "香蕉" });
    fireEvent.click(screen.getByRole("button", { name: "创作者分享" }));
    fireEvent.change(screen.getByRole("combobox", { name: "排序依据" }), {
      target: { value: "title" },
    });
    const titles = () =>
      Array.from(document.querySelectorAll(".gallery-grid h3")).map(
        (h) => h.textContent,
      );
    expect(titles()).toEqual(["苹果", "香蕉"]);
    fireEvent.click(screen.getByRole("button", { name: /排序顺序：升序/ }));
    expect(titles()).toEqual(["香蕉", "苹果"]);
  });
  it("pages filtered results and searches older shared lessons across API pages", async () => {
    getJson.mockImplementation(async (path: string) => {
      if (path === "/api/covers") return { covers: {} };
      if (path === "/api/shared")
        return {
          lessons: Array.from({ length: 24 }, (_, i) =>
            summary({
              id: i.toString(16).padStart(16, "0"),
              title: { en: `Shared lesson ${i}`, zh: `分享课程 ${i}` },
            }),
          ),
          cursor: "48",
        };
      if (path === "/api/shared?cursor=48")
        return {
          lessons: [
            summary({
              id: "3333333333333333",
              title: { en: "Older hidden lesson", zh: "旧课程" },
            }),
          ],
          cursor: null,
        };
      throw new Error("unexpected request " + path);
    });
    render(<Gallery language="en" />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Lessons per page" }),
      { target: { value: "24" } },
    );
    await waitFor(() => expect(screen.getByText("48 lessons")).toBeTruthy());
    expect(
      screen.queryByRole("heading", { name: "Older hidden lesson" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(
      screen.getByRole("heading", { name: "Older hidden lesson" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement?.className).toBe("gallery-grid"),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "title" },
    });
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "default" },
    });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search lessons" }),
      { target: { value: "旧课程" } },
    );
    expect(
      screen.getByRole("heading", { name: "Older hidden lesson" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search lessons" }),
      { target: { value: "" } },
    );
    expect(
      screen.queryByRole("heading", { name: "Older hidden lesson" }),
    ).toBeNull();
  });
  it("offers a retry when loading shared pages fails", async () => {
    getJson.mockImplementation(async (path: string) => {
      if (path === "/api/covers") return { covers: {} };
      throw new Error("down");
    });
    render(<Gallery language="en" />);
    expect(
      await screen.findByText(/Some shared lessons could not be loaded/),
    ).toBeTruthy();
    getJson.mockImplementation(async (path: string) =>
      path === "/api/shared"
        ? {
            lessons: [
              summary({
                id: "3333333333333333",
                title: { en: "Recovered shared lesson", zh: "课程" },
              }),
            ],
            cursor: null,
          }
        : { covers: {} },
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("24 lessons");
    expect(
      screen.queryByText(/Some shared lessons could not be loaded/),
    ).toBeNull();
  });
  it("searches both languages, filters by kind and lists shared lessons from creators", async () => {
    getJson.mockResolvedValue({
      lessons: [
        summary({ id: "fedcba9876543210", kind: "process", shared: true }),
      ],
    });
    render(<Gallery language="en" />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Lessons per page" }),
      { target: { value: "24" } },
    );
    // One grid: reviewed, evaluation and shared lessons share one card.
    expect(
      await screen.findByRole("link", { name: /Open lesson: Cooling coffee/ }),
    ).toBeTruthy();
    expect(screen.getByText("24 lessons")).toBeTruthy();
    // The summary line counts shows and compared questions across all three sources.
    const summaryLine =
      document.querySelector(".gallery .section-title p.fine")?.textContent ??
      "";
    // Reviewed lessons with a show carry a Watch link; the shared lesson's show opens
    // from its lesson page, so it counts without a link.
    const shows = screen.getAllByRole("link", {
      name: /^Watch the show/,
    }).length;
    expect(summaryLine).toBe(
      `24 lessons · ${shows + 1} with a narrated show · 3 compared across two models`,
    );
    expect(screen.getAllByText("From the evaluation").length).toBe(15);
    expect(screen.getAllByText("Shared").length).toBe(2);
    const search = screen.getByRole("searchbox", { name: "Search lessons" });
    fireEvent.change(search, { target: { value: "单摆" } });
    expect(screen.getByText("2 lessons")).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Open lesson: Cooling coffee/ }),
    ).toBeNull();
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Process explorers" }));
    expect(screen.getByText("6 lessons")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(
      screen.getByRole("button", { name: "From the evaluation" }),
    );
    expect(screen.getByText("14 lessons")).toBeTruthy();
    // Both models' replies to the same question link to one comparison.
    expect(
      screen
        .getAllByRole("link", {
          name: /Compare the two models: Why does a bacterial/,
        })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#compare:logistic-growth-en", "#compare:logistic-growth-en"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Any" })[0]);
    expect(
      screen
        .getByRole("link", { name: /Open lesson: Cooling coffee/ })
        .getAttribute("href"),
    ).toBe("#shared:fedcba9876543210");
    // The Depth facet separates the two coached benches from everything else.
    fireEvent.click(screen.getByRole("button", { name: "Coached by Muse" }));
    expect(screen.getByText("2 lessons")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Open the bench: Physics/ })
        .getAttribute("href"),
    ).toBe("#physics");
    fireEvent.click(screen.getAllByRole("button", { name: "Any" })[1]);
    // The toggles narrow further: only the sketch lesson is from a sketch.
    fireEvent.click(screen.getByRole("checkbox", { name: "From a sketch" }));
    expect(screen.getByText("1 lessons")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "From a sketch" }));
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText(/No lesson matches/)).toBeTruthy();
  });
  it("leaves shared lessons out when the public list is unavailable", async () => {
    getJson.mockRejectedValue(new Error("down"));
    render(<Gallery language="zh" />);
    expect(await screen.findByText("23 节课程")).toBeTruthy();
    // The Source chip remains; no card carries the badge.
    expect(screen.getAllByText("创作者分享").length).toBe(1);
  });
});
