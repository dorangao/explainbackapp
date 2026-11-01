import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Studio } from "./Studio";
import type { CompareReply, Lesson, Post, Status } from "../lib/types";
import {
  coolingLesson,
  processLesson,
} from "../../test-support/generated-lessons.mjs";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
const model = (id: string, model: string) => ({
  id,
  label: model,
  provider: "meta",
  model,
  configured: true,
  timeoutMs: 100,
});
const status: Status = {
  configured: true,
  models: [
    model("meta:muse-wonder-1.0", "muse-wonder-1.0"),
    model("meta:muse-spark-1.3", "muse-spark-1.3"),
  ],
  defaultModel: "meta:muse-wonder-1.0",
  roles: { creator: "meta:muse-wonder-1.0", tester: "meta:muse-spark-1.3" },
  traceEnabled: false,
  access: null,
  problems: [],
};
const full = {
  neutralFraming: 2,
  quantityNames: 2,
  transferClarity: 2,
  bilingualParity: 2,
  assumptions: 2,
};
const reply: CompareReply = {
  question: "Why does coffee cool?",
  promptVersion: "author-v3",
  judgeVersion: "studio-judge-v1",
  judge: "muse-spark-1.3",
  attemptsRemaining: 4,
  elapsedMs: 12000,
  replies: [
    {
      model: "muse-wonder-1.0",
      llm: "meta:muse-wonder-1.0",
      status: "ready",
      message: { en: "Ready", zh: "已就绪" },
      lesson: coolingLesson() as Lesson,
      kind: "model",
      checks: { renderer: true, chapters: true, outputUnit: true },
      automatedPass: true,
      judge: {
        model: "muse-spark-1.3",
        total: 10,
        max: 10,
        scores: full,
        issues: [],
        summary: "Clear and consistent.",
      },
      elapsedMs: 9800,
      usage: { input: 1400, output: 1900 },
    },
    {
      model: "muse-spark-1.3",
      llm: "meta:muse-spark-1.3",
      status: "ready",
      message: { en: "Ready", zh: "已就绪" },
      lesson: processLesson() as Lesson,
      kind: "process",
      checks: { renderer: true, chapters: true },
      automatedPass: true,
      judge: {
        model: "muse-spark-1.3",
        total: 8,
        max: 10,
        scores: { ...full, bilingualParity: 1, quantityNames: 1 },
        issues: ["A stage title mixes languages."],
        summary: "Mostly clear.",
      },
      elapsedMs: 7000,
      usage: { input: 2600, output: 2200 },
    },
  ],
};

function mount(post: Post, language: "en" | "zh" = "en") {
  return render(
    <Studio
      language={language}
      authenticated
      status={status}
      post={post}
      visible
      view="create"
      lessonId={null}
      starter={0}
      onBusy={() => {}}
      onRequestAccess={() => {}}
    />,
  );
}

describe("Compare two models in Studio", () => {
  it("sends the question once, shows both replies with the judge's view, and carries the chosen draft into review", async () => {
    const posted: { path: string; body: unknown }[] = [];
    const post: Post = async (path, body) => {
      posted.push({ path, body });
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compare") return reply as never;
      return { records: [] } as never;
    };
    mount(post);
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Why does coffee cool?" },
    });
    // The judge defaults to the tester role; the creator picks Wonder instead.
    const judgePick = screen.getByLabelText(
      /Rubric judge/,
    ) as HTMLSelectElement;
    expect(judgePick.value).toBe("meta:muse-spark-1.3");
    fireEvent.change(judgePick, { target: { value: "meta:muse-wonder-1.0" } });
    fireEvent.click(screen.getByRole("button", { name: /Compare two models/ }));
    expect(
      await screen.findByRole("heading", { name: "Compare the two models" }),
    ).toBeTruthy();
    expect(
      posted.filter((p) => p.path === "/api/studio/compare").map((p) => p.body),
    ).toEqual([
      {
        sessionId: "s1",
        topic: "Why does coffee cool?",
        judge: "meta:muse-wonder-1.0",
      },
    ]);
    const comparison = screen.getByRole("region", {
      name: "Compare the two models",
    });
    expect(comparison.querySelectorAll(".compare-column").length).toBe(2);
    expect(screen.getByText("AI wording rubric · 10/10")).toBeTruthy();
    expect(screen.getByText("AI wording rubric · 8/10")).toBeTruthy();
    expect(screen.getByText("A stage title mixes languages.")).toBeTruthy();
    expect(screen.getAllByText("Passed the app's checks").length).toBe(4);
    // Choosing Spark's draft opens the normal review flow with that lesson.
    const [, useSpark] = screen.getAllByRole("button", {
      name: /Review this draft/,
    });
    fireEvent.click(useSpark);
    expect(
      await screen.findByText(/Draft from muse-spark-1.3 ready/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Why does coffee cool?" }),
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: processLesson().title.en }),
    ).toBeTruthy();
    // No other model call was made for the choice.
    expect(posted.filter((p) => p.path.startsWith("/api/studio")).length).toBe(
      2,
    );
  });
  it("shows a declined and a rejected reply without a review button, and the button is absent when the roles share one model", async () => {
    const post: Post = async (path) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compare")
        return {
          ...reply,
          judge: null,
          replies: [
            {
              ...reply.replies[0],
              status: "unsupported",
              lesson: null,
              kind: null,
              message: { en: "Not a bounded model.", zh: "不是有界模型。" },
              judge: null,
            },
            {
              ...reply.replies[1],
              status: "rejected",
              lesson: null,
              kind: null,
              reason: "Possible division by zero.",
              automatedPass: false,
              judge: null,
            },
          ],
        } as never;
      return { records: [] } as never;
    };
    mount(post, "zh");
    fireEvent.change(screen.getByLabelText(/你想探索什么/), {
      target: { value: "预测股价" },
    });
    fireEvent.click(screen.getByRole("button", { name: /比较两个模型/ }));
    expect(await screen.findAllByText("拒绝了请求")).toHaveLength(2);
    expect(screen.getByText("不是有界模型。")).toBeTruthy();
    expect(screen.getAllByText("被校验器拒绝")).toHaveLength(2);
    expect(screen.getByText("Possible division by zero.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /审阅这份草稿/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "放弃比较" }));
    expect(screen.queryByText("拒绝了请求")).toBeNull();
    cleanup();
    render(
      <Studio
        language="en"
        authenticated
        status={{
          ...status,
          roles: {
            creator: "meta:muse-spark-1.3",
            tester: "meta:muse-spark-1.3",
          },
        }}
        post={post}
        visible
        view="create"
        lessonId={null}
        starter={0}
        onBusy={() => {}}
        onRequestAccess={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Compare two models/ }),
    ).toBeNull();
    expect(screen.queryByLabelText(/Rubric judge/)).toBeNull();
  });
});
