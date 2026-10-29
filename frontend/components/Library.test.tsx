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
describe("LessonShelf", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
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
  it("searches both languages, filters by kind and lists shared lessons from creators", async () => {
    getJson.mockResolvedValue({
      lessons: [
        summary({ id: "fedcba9876543210", kind: "process", shared: true }),
      ],
    });
    render(<Gallery language="en" />);
    expect(
      await screen.findByRole("heading", { name: "Fresh from the Studio." }),
    ).toBeTruthy();
    expect(screen.getByText("7 lessons")).toBeTruthy();
    const search = screen.getByRole("searchbox", { name: "Search lessons" });
    fireEvent.change(search, { target: { value: "单摆" } });
    expect(screen.getByText("2 lessons")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Fresh from the Studio." }),
    ).toBeNull();
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Process explorers" }));
    expect(screen.getByText("2 lessons")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Open lesson: Cooling coffee/ })
        .getAttribute("href"),
    ).toBe("#shared:fedcba9876543210");
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText(/No lesson matches/)).toBeTruthy();
  });
  it("leaves the shared section out when the public list is unavailable", async () => {
    getJson.mockRejectedValue(new Error("down"));
    render(<Gallery language="zh" />);
    expect(await screen.findByText("6 节课程")).toBeTruthy();
    expect(screen.queryByText("创作者分享")).toBeNull();
  });
});
