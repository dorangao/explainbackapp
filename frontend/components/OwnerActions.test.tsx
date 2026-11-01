import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { OwnerActions } from "./OwnerActions";
import { onSharedChanged } from "../lib/library";
import type { Post } from "../lib/types";

afterEach(cleanup);

describe("OwnerActions", () => {
  it("links Edit to the saved copy and deletes only after a second click, telling the library", async () => {
    const posts: { path: string; body: unknown }[] = [];
    const post = (async (path: string, body?: unknown) => {
      posts.push({ path, body });
      return { deleted: true, id: "0123456789abcdef" };
    }) as unknown as Post;
    const onDeleted = vi.fn(),
      onNotice = vi.fn(),
      changed = vi.fn();
    const stop = onSharedChanged(changed);
    render(
      <OwnerActions
        language="en"
        id="0123456789abcdef"
        post={post}
        onDeleted={onDeleted}
        onNotice={onNotice}
      />,
    );
    expect(
      screen
        .getByRole("link", { name: "Edit this lesson" })
        .getAttribute("href"),
    ).toBe("#edit:0123456789abcdef");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(posts).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() =>
      expect(onDeleted).toHaveBeenCalledWith("0123456789abcdef"),
    );
    expect(posts).toEqual([
      { path: "/api/lessons/delete", body: { id: "0123456789abcdef" } },
    ]);
    expect(onNotice).toHaveBeenCalledWith("Lesson deleted.");
    expect(changed).toHaveBeenCalledTimes(1);
    stop();
  });
  it("reports a failed delete and stays", async () => {
    const post = (async () => {
      throw new Error("offline");
    }) as unknown as Post;
    const onDeleted = vi.fn(),
      onNotice = vi.fn();
    render(
      <OwnerActions
        language="zh"
        id="0123456789abcdef"
        post={post}
        onDeleted={onDeleted}
        onNotice={onNotice}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(onNotice).toHaveBeenCalledTimes(1));
    expect(onNotice.mock.calls[0][0]).toMatch(/无法删除/);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "删除" })).toBeTruthy();
  });
});
