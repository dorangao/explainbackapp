import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Studio } from "./Studio";
const shelf = vi.hoisted(() => ({ record: null as unknown }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  getJson: async (path: string) =>
    path === "/api/lessons"
      ? { lessons: shelf.record ? [shelf.record] : [], limit: 50 }
      : shelf.record,
}));
vi.mock("../lib/recorder", () => ({
  MicrophoneError: class extends Error {},
  startRecording: vi.fn(async () => ({
    stop: async () => ({ wav: new Blob(["pcm"]), durationMs: 1500 }),
  })),
  blobToBase64: async () => "QUJD",
}));
import type { Lesson, Post, Status } from "../lib/types";
import { ApiError } from "../lib/api";
import {
  coolingLesson,
  processLesson,
} from "../../test-support/generated-lessons.mjs";

afterEach(() => {
  cleanup();
  // The remembered draft is per browser; each test starts from an empty one.
  localStorage.clear();
});
const status: Status = {
  configured: true,
  models: [
    {
      id: "meta:test",
      label: "Test",
      provider: "meta",
      model: "test",
      configured: true,
      timeoutMs: 100,
    },
  ],
  defaultModel: "meta:test",
  roles: { creator: "meta:test", tester: "meta:test" },
  traceEnabled: false,
  access: null,
  problems: [],
};
function mount(
  overrides: Partial<Parameters<typeof Studio>[0]> = {},
  post?: Post,
) {
  const calls: string[] = [];
  const fakePost: Post =
    post ??
    (async (path) => {
      calls.push(path);
      return { records: [] } as never;
    });
  const props = {
    language: "en" as const,
    authenticated: false,
    status: null,
    post: fakePost,
    visible: true,
    view: "studio" as const,
    lessonId: null,
    starter: 0,
    onBusy: () => {},
    onRequestAccess: () => {},
    ...overrides,
  };
  const view = render(<Studio {...props} />);
  return {
    ...view,
    calls,
    props,
    rerender: (next: Partial<typeof props>) =>
      view.rerender(<Studio {...props} {...next} />),
  };
}

describe("Studio gallery playback", () => {
  it("opens a reviewed lesson signed out, completes it locally and keeps progress across a language change", async () => {
    const { calls, rerender } = mount({ lessonId: "web-cache" });
    expect(
      await screen.findByRole("heading", {
        name: /Loading a web page with a cache/,
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Disagree$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Test this claim/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show final state/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explain the result/ }));
    expect(screen.queryByRole("button", { name: /Ask the model/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Try a fresh case/ }));
    rerender({ language: "zh" });
    expect(
      screen.getByRole("heading", { name: /使用缓存加载网页/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^发送条件请求/ }));
    expect(await screen.findByText(/与本模型的结果相符/)).toBeTruthy();
    expect(calls.filter((c) => c.startsWith("/api/studio"))).toEqual([]);
  });
});

describe("Studio authoring", () => {
  it("polls a background Wonder creation and opens the finished draft", async () => {
    const paths: string[] = [];
    const wonder = {
      ...status.models[0],
      id: "meta:muse-wonder-1.0",
      model: "muse-wonder-1.0",
      label: "Wonder",
    };
    const post: Post = async (path, body) => {
      paths.push(path);
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose") {
        expect((body as { background?: boolean }).background).toBe(true);
        return { pending: true, attemptsRemaining: 7 } as never;
      }
      if (path === "/api/studio/poll")
        return {
          status: "ready",
          lesson: coolingLesson(),
          message: { en: "Ready", zh: "已就绪" },
          attemptsRemaining: 7,
        } as never;
      return { records: [] } as never;
    };
    mount(
      {
        authenticated: true,
        status: {
          ...status,
          models: [wonder],
          defaultModel: wonder.id,
          roles: { creator: wonder.id, tester: wonder.id },
        },
        view: "create",
      },
      post,
    );
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Cooling" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    expect(await screen.findByText(/Draft ready/)).toBeTruthy();
    expect(paths).toEqual([
      "/api/studio/session",
      "/api/studio/compose",
      "/api/studio/poll",
    ]);
  });
  it("creates a draft through one explicit request, needs review before presenting, and edits revoke review", async () => {
    const posted: { path: string; body: unknown }[] = [];
    const post: Post = async (path, body) => {
      posted.push({ path, body });
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        return {
          status: "ready",
          lesson: coolingLesson(),
          message: { en: "Ready", zh: "已就绪" },
          attemptsRemaining: 7,
          model: "test",
          elapsedMs: 1200,
          usage: { input: 10, output: 20 },
        } as never;
      return { records: [] } as never;
    };
    mount({ authenticated: true, status, view: "create" }, post);
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Cooling coffee" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    expect(await screen.findByText(/Draft ready/)).toBeTruthy();
    expect(posted.map((p) => p.path)).toEqual([
      "/api/studio/session",
      "/api/studio/compose",
    ]);
    const present = await screen.findByRole("button", { name: /Present/ });
    await waitFor(() =>
      expect(document.body.textContent).toMatch(
        /test drafted this lesson · 1\.2 s · 1 request · 10 tokens in \/ 20 out/,
      ),
    );
    expect((present as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /reviewed/i }));
    expect((present as HTMLButtonElement).disabled).toBe(false);
    const title = screen.getByLabelText(/Lesson title/);
    fireEvent.change(title, { target: { value: "Revised title" } });
    expect(
      (screen.getByRole("button", { name: /Present/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("shows what a revision changed, field by field, and dismisses it", async () => {
    let n = 0;
    const post: Post = async (path) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose") {
        n++;
        const lesson = coolingLesson();
        if (n === 2) {
          lesson.title.en = "Why coffee cooling slows down";
          lesson.chapters[0].demo.inputs[0].max = 95;
        }
        return {
          status: "ready",
          lesson,
          message: { en: "", zh: "" },
          attemptsRemaining: 8 - n,
          model: "test",
          elapsedMs: 900,
          usage: null,
        } as never;
      }
      return { records: [] } as never;
    };
    mount({ authenticated: true, status, view: "create" }, post);
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Cooling" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    await screen.findByText(/Draft ready/);
    fireEvent.change(screen.getByLabelText(/Ask Muse to revise/i), {
      target: { value: "Rename the title and cap the initial temperature." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Revise/ }));
    const summary = await screen.findByRole("heading", {
      name: /2 fields changed/,
    });
    const panel = summary.closest("section")!;
    expect(within(panel).getByText("Lesson title")).toBeTruthy();
    expect(within(panel).getByText("Cooling coffee")).toBeTruthy();
    expect(
      within(panel).getByText("Why coffee cooling slows down"),
    ).toBeTruthy();
    expect(within(panel).getByText("Input initial max")).toBeTruthy();
    expect(panel.textContent).toMatch(
      /test revised this lesson · 0\.9 s · 1 request/,
    );
    fireEvent.click(
      within(panel).getByRole("button", { name: /Restore previous draft/ }),
    );
    expect(screen.getByText(/Restored the previous draft/)).toBeTruthy();
    expect(
      (screen.getByLabelText(/Lesson title/) as HTMLInputElement).value,
    ).toBe("Cooling coffee");
    expect(n).toBe(2);
    expect(
      screen.queryByRole("heading", { name: /fields changed/ }),
    ).toBeNull();
  });
  it("discards a late compose reply after the language changes and keeps no draft", async () => {
    let release: (() => void) | null = null;
    const post: Post = async (path) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose") {
        await new Promise<void>((r) => (release = r));
        return {
          status: "ready",
          lesson: processLesson(),
          message: { en: "", zh: "" },
          attemptsRemaining: 7,
        } as never;
      }
      return { records: [] } as never;
    };
    const { rerender } = mount(
      { authenticated: true, status, view: "create" },
      post,
    );
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Web" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    await waitFor(() => expect(release).not.toBeNull());
    rerender({ language: "zh" });
    expect(await screen.findByText(/语言已切换/)).toBeTruthy();
    await act(async () => {
      release!();
      await Promise.resolve();
    });
    expect(
      screen.queryByRole("button", { name: /开始演示|Present/ }),
    ).toBeNull();
    expect(screen.getByLabelText(/你想探索什么/)).toBeTruthy();
  });
});

describe("Studio generated lesson player", () => {
  it("changing a parameter resets the prediction and keeps the value across a language change", async () => {
    const post: Post = async (path) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        return {
          status: "ready",
          lesson: coolingLesson(),
          message: { en: "", zh: "" },
          attemptsRemaining: 7,
        } as never;
      return { records: [] } as never;
    };
    const { rerender } = mount(
      { authenticated: true, status, view: "create" },
      post,
    );
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Cooling" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    await screen.findByText(/Draft ready/);
    fireEvent.click(await screen.findByRole("checkbox", { name: /reviewed/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Present this lesson/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /^Agree$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Test this claim/ }));
    const initial = screen.getByRole("spinbutton", {
      name: /Initial temperature/,
    });
    // Numeric inputs commit on blur so a half-typed value never resets the prediction.
    fireEvent.change(initial, { target: { value: "90" } });
    fireEvent.blur(initial, { target: { value: "90" } });
    expect(await screen.findByRole("button", { name: /^Agree$/ })).toBeTruthy();
    rerender({ language: "zh" });
    expect(
      (screen.getByRole("spinbutton", { name: /初始温度/ }) as HTMLInputElement)
        .value,
    ).toBe("90");
  });
});
vi.stubGlobal("scrollTo", () => {});

describe("Explain it back", () => {
  it("sends the learner's own explanation to the guide and shows the verdict and follow-up", async () => {
    const bodies: Record<string, unknown>[] = [];
    const post: Post = async (path, body) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/guide") {
        bodies.push(body as Record<string, unknown>);
        return {
          verdict: "partly",
          explanation: "You saw that the cache answers faster; say why.",
          followUp:
            "What does the browser skip when the cache already holds the page?",
          nextAction: "transfer",
          attemptsRemaining: 7,
          model: "test",
          elapsedMs: 800,
          usage: null,
        } as never;
      }
      return { records: [] } as never;
    };
    mount({ authenticated: true, status, lessonId: "web-cache" }, post);
    await screen.findByRole("heading", {
      name: /Loading a web page with a cache/,
    });
    fireEvent.click(screen.getByRole("button", { name: /^Agree$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Test this claim/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show final state/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explain the result/ }));
    const check = screen.getByRole("button", {
      name: /Check my explanation with Muse/,
    }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    fireEvent.change(
      screen.getByLabelText(/Explain what changed and why, in your own words/),
      { target: { value: "  The cached copy skips the network round trip. " } },
    );
    expect(check.disabled).toBe(false);
    fireEvent.click(check);
    expect(
      await screen.findByText("Partly supported by the evidence"),
    ).toBeTruthy();
    expect(screen.getByText(/What does the browser skip/)).toBeTruthy();
    expect(document.querySelector(".request-summary")?.textContent).toMatch(
      /test explained this result · 0\.8 s/,
    );
    expect(bodies).toHaveLength(1);
    expect(bodies[0].explanation).toBe(
      "The cached copy skips the network round trip.",
    );
    expect(bodies[0].prediction).toBe("agree");
    // The plain "ask Muse" button sends no learner text.
    fireEvent.click(
      screen.getByRole("button", { name: /Ask Muse to explain this result/ }),
    );
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].explanation).toBeUndefined();
  });
  it("records a spoken explanation, transcribes it with Muse Voice and fills the textarea", async () => {
    const bodies: Record<string, unknown>[] = [];
    const post: Post = async (path, body) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/transcribe") {
        bodies.push(body as Record<string, unknown>);
        return {
          text: "The cached copy skips the network round trip.",
          model: "muse-voice-transcribe-1.0",
          elapsedMs: 900,
          usage: null,
          attemptsRemaining: 8,
        } as never;
      }
      return { records: [] } as never;
    };
    mount(
      {
        authenticated: true,
        status: { ...status, voice: true },
        lessonId: "web-cache",
      },
      post,
    );
    await screen.findByRole("heading", {
      name: /Loading a web page with a cache/,
    });
    fireEvent.click(screen.getByRole("button", { name: /^Agree$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Test this claim/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show final state/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explain the result/ }));
    fireEvent.click(screen.getByRole("button", { name: /Say it instead/ }));
    const stop = await screen.findByRole("button", {
      name: /Stop and transcribe/,
    });
    expect(screen.getByText(/Recording… up to one minute/)).toBeTruthy();
    fireEvent.click(stop);
    expect(
      await screen.findByText(/Transcribed by Muse Voice Transcribe/),
    ).toBeTruthy();
    const textarea = screen.getByLabelText(
      /Explain what changed and why, in your own words/,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe(
      "The cached copy skips the network round trip.",
    );
    expect(bodies).toEqual([
      { sessionId: "s1", language: "en", audio: "QUJD" },
    ]);
    expect(document.querySelector(".request-summary")?.textContent).toMatch(
      /muse-voice-transcribe-1\.0 transcribed your explanation · 0\.9 s/,
    );
    expect(
      (
        screen.getByRole("button", {
          name: /Check my explanation with Muse/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("hides the microphone when the server has no voice model", async () => {
    mount({ authenticated: true, status, lessonId: "web-cache" });
    await screen.findByRole("heading", {
      name: /Loading a web page with a cache/,
    });
    fireEvent.click(screen.getByRole("button", { name: /^Agree$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Test this claim/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show final state/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explain the result/ }));
    expect(screen.queryByRole("button", { name: /Say it instead/ })).toBeNull();
  });
  it("keeps the textarea without access and explains that feedback needs it", async () => {
    mount({ lessonId: "web-cache" });
    await screen.findByRole("heading", {
      name: /Loading a web page with a cache/,
    });
    fireEvent.click(screen.getByRole("button", { name: /^Agree$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Test this claim/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show final state/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explain the result/ }));
    expect(
      screen.getByLabelText(/Explain what changed and why, in your own words/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Check my explanation with Muse/ }),
    ).toBeNull();
    expect(screen.getByText(/needs creation access/)).toBeTruthy();
  });
});

describe("Creator and test learner roles", () => {
  it("starts on the creator model the server names and labels the test learner", async () => {
    const wonder = {
      id: "meta:wonder",
      label: "Meta · wonder",
      provider: "meta",
      model: "wonder",
      configured: true,
      timeoutMs: 100,
    };
    mount({
      authenticated: true,
      view: "create",
      status: {
        ...status,
        models: [...status.models, wonder],
        roles: { creator: "meta:wonder", tester: "meta:test" },
      },
    });
    expect(
      (screen.getByLabelText(/Creator model/) as HTMLSelectElement).value,
    ).toBe("meta:wonder");
  });
  it("lets the test learner try a draft, shows checked answers and feeds suggestions into a revision", async () => {
    const bodies: Record<string, unknown>[] = [];
    const post: Post = async (path, body) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        return {
          status: "ready",
          lesson: coolingLesson(),
          message: { en: "", zh: "" },
          attemptsRemaining: 7,
          model: "test",
          elapsedMs: 900,
          usage: null,
        } as never;
      if (path === "/api/studio/tryout") {
        bodies.push(body as Record<string, unknown>);
        return {
          chapters: [
            {
              prediction: "unsure",
              reason: "Hot drinks cool, but I am not sure how fast.",
              explanation:
                "The gap to room temperature shrinks, so cooling slows.",
              transfer: {
                given: "41.2",
                correct: false,
                type: "number",
                unit: "°C",
              },
              confusions: ["The rate unit 1/min is unexplained."],
              suggestions: ["Explain what the rate means in plain words."],
            },
          ],
          overall: "Clear framing; the rate needs one sentence.",
          rating: 4,
          llm: status.models[0],
          attemptsRemaining: 6,
          model: "test",
          elapsedMs: 1200,
          usage: { input: 900, output: 200 },
        } as never;
      }
      return { records: [] } as never;
    };
    mount({ authenticated: true, status, view: "create" }, post);
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Cooling" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    await screen.findByText(/Draft ready/);
    expect(screen.getByText(/Test learner: Test/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Let the test learner try/ }),
    );
    await screen.findByText(/Clear framing; the rate needs one sentence/);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].language).toBe("en");
    expect((bodies[0].lesson as { version: number }).version).toBe(2);
    const report = screen.getByText(/Clear framing/).closest(".tryout-report")!;
    expect(report.textContent).toMatch(/4\/5 clarity/);
    expect(report.textContent).toMatch(/41\.2 °C\s*incorrect/);
    expect(report.textContent).toMatch(/Not sure · Hot drinks cool/);
    expect(report.textContent).toMatch(/The rate unit 1\/min is unexplained/);
    expect(report.textContent).toMatch(
      /test tried this lesson as a test learner · 1\.2 s · 1 request · 900 tokens in \/ 200 out/,
    );
    fireEvent.click(
      within(report as HTMLElement).getByRole("button", {
        name: /Use these suggestions in a revision/,
      }),
    );
    expect(
      (screen.getByLabelText(/Ask Muse to revise/i) as HTMLTextAreaElement)
        .value,
    ).toBe("Explain what the rate means in plain words.");
  });
});

describe("Lesson show", () => {
  it("makes a show for a draft, opens the player with the cover and returns to the review", async () => {
    const bodies: Record<string, unknown>[] = [];
    const post: Post = async (path, body) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        return {
          status: "ready",
          lesson: coolingLesson(),
          message: { en: "", zh: "" },
          attemptsRemaining: 7,
          model: "test",
          elapsedMs: 900,
          usage: null,
        } as never;
      if (path === "/api/studio/show") {
        bodies.push(body as Record<string, unknown>);
        const s = (kind: string) => ({
          kind,
          chapter: 0,
          heading: { en: kind + " heading", zh: kind },
          narration: { en: "Spoken " + kind + ".", zh: kind },
        });
        return {
          show: {
            version: 1,
            slides: [s("cover"), s("claim"), s("experiment"), s("takeaway")],
            coverPrompt: "A mug",
          },
          cover: "data:image/webp;base64,QUJD",
          coverModel: "muse-image-1.0",
          llm: status.models[0],
          attemptsRemaining: 6,
          model: "test",
          elapsedMs: 3000,
          usage: null,
        } as never;
      }
      return { records: [] } as never;
    };
    mount({ authenticated: true, status, view: "create" }, post);
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Cooling" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    await screen.findByText(/Draft ready/);
    fireEvent.click(
      screen.getByRole("button", { name: /Make a narrated show/ }),
    );
    await screen.findByText("Spoken cover.");
    expect(bodies).toHaveLength(1);
    expect((bodies[0].lesson as { version: number }).version).toBe(2);
    expect(document.querySelector(".show-cover img")?.getAttribute("src")).toBe(
      "data:image/webp;base64,QUJD",
    );
    expect(
      screen.queryByRole("button", { name: /Present this lesson/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Close show/ }));
    expect(
      screen.getByRole("button", { name: /Present this lesson/ }),
    ).toBeTruthy();
    expect(document.querySelector(".request-summary")?.textContent).toMatch(
      /test wrote the show for this lesson · 3\.0 s/,
    );
    fireEvent.click(screen.getByRole("button", { name: /Watch the show/ }));
    expect(await screen.findByText("Spoken cover.")).toBeTruthy();
  });
});

describe("Rejection reason", () => {
  it("preserves a background claim rejection and does not poll it again", async () => {
    const wonder = {
      ...status.models[0],
      id: "meta:muse-wonder-1.0",
      model: "muse-wonder-1.0",
      label: "Wonder",
    };
    let polls = 0;
    const post: Post = async (path) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        return { pending: true, attemptsRemaining: 7 } as never;
      if (path === "/api/studio/poll") {
        polls++;
        throw new ApiError(
          "Rejected",
          502,
          "BACKGROUND_FAILED",
          7,
          "Prediction claim must be a statement, not a question, in both languages.",
        );
      }
      return { records: [] } as never;
    };
    mount(
      {
        authenticated: true,
        status: {
          ...status,
          models: [wonder],
          defaultModel: wonder.id,
          roles: { creator: wonder.id, tester: wonder.id },
        },
        view: "create",
      },
      post,
    );
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Cooling" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    expect(
      (await screen.findByText(/Prediction claim must be a statement/))
        .textContent,
    ).toMatch(/Reason:/);
    expect(polls).toBe(1);
    expect(
      (
        screen.getByLabelText(
          /What would you like to explore/,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("Cooling");
  });
  it("shows the server's reason under the generic failure line", async () => {
    const post: Post = async (path) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        throw new ApiError(
          "Provider lesson could not be completed or validated. Retry explicitly.",
          502,
          undefined,
          7,
          "Use 3–6 process stages.",
        );
      return { records: [] } as never;
    };
    mount({ authenticated: true, status, view: "create" }, post);
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Differentiation rules" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    const message = await screen.findByText(/could not be completed/);
    expect(message.textContent).toMatch(/Reason: Use 3–6 process stages\./);
  });
});

describe("Remembered lesson", () => {
  const tryoutReply = {
    chapters: [
      {
        prediction: "unsure",
        reason: "Not sure.",
        explanation: "The gap shrinks.",
        transfer: { given: "41.2", correct: true, type: "number", unit: "°C" },
        confusions: [],
        suggestions: ["Say what the rate means."],
      },
    ],
    overall: "Clear framing; the rate needs one sentence.",
    rating: 4,
    llm: status.models[0],
    attemptsRemaining: 6,
  };
  const showReply = {
    show: {
      version: 1,
      slides: [
        {
          kind: "cover",
          chapter: 0,
          heading: { en: "Cover", zh: "封面" },
          narration: { en: "Spoken cover.", zh: "封面旁白。" },
        },
      ],
      coverPrompt: "A mug",
    },
    cover: null,
    coverModel: null,
    llm: status.models[0],
    attemptsRemaining: 5,
  };
  it("restores the draft, review state and cached results without any provider request, and marks results stale after an edit", async () => {
    const { fingerprint } = await import("../lib/studio-cache");
    const { saveStudio } = await import("../lib/studio-store");
    const draft = coolingLesson() as unknown as Lesson;
    saveStudio({
      draft,
      topic: "Cooling coffee",
      creation: "generated",
      reviewed: true,
      revisionPrompt: "Simplify the wording.",
      compose: { at: Date.UTC(2026, 9, 28, 17, 42), key: "c" },
      revise: null,
      tryout: {
        reply: tryoutReply as never,
        at: Date.UTC(2026, 9, 28, 17, 45),
        key: fingerprint({ lesson: draft, language: "en" }),
      },
      show: {
        reply: showReply as never,
        at: Date.UTC(2026, 9, 28, 17, 50),
        key: fingerprint({ lesson: draft }),
      },
      guide: {},
      explanations: {},
      player: null,
      presenting: false,
      pace: "off",
    });
    const { calls } = mount({ authenticated: true, status, view: "create" });
    expect(
      await screen.findByRole("heading", { name: "Cooling coffee" }),
    ).toBeTruthy();
    expect(screen.getByText(/Restored your last lesson/)).toBeTruthy();
    expect(
      screen.queryByLabelText(/What would you like to explore/),
    ).toBeNull();
    expect(
      (screen.getByRole("checkbox", { name: /reviewed/i }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText(/Ask Muse to revise/i) as HTMLTextAreaElement)
        .value,
    ).toBe("Simplify the wording.");
    expect(screen.getByText(/Clear framing; the rate needs/)).toBeTruthy();
    const tryoutSection = screen.getByText(/Clear framing/).closest("section")!;
    const tryoutButton = within(tryoutSection).getByRole("button", {
      name: /^Re-run$/,
    });
    expect(tryoutButton).toBeTruthy();
    expect(
      within(tryoutSection).getByText(/Cached result/).textContent,
    ).toMatch(/Inputs unchanged since .*No model request was made/);
    expect(screen.getByRole("button", { name: /Watch the show/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Re-run$/ })).toHaveLength(2);
    expect(screen.getByText(/Muse drafted this lesson/)).toBeTruthy();
    expect(calls.filter((c) => c.startsWith("/api/studio"))).toEqual([]);
    // An edit marks the lesson-dependent results stale and asks for an explicit send.
    fireEvent.change(screen.getByLabelText(/Lesson title/), {
      target: { value: "Cooling coffee, revisited" },
    });
    expect(
      screen.getAllByRole("button", { name: /Send changes to Muse/ }),
    ).toHaveLength(2);
    expect(screen.getAllByText(/Inputs changed since/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^Re-run$/ })).toBeNull();
    expect(calls.filter((c) => c.startsWith("/api/studio"))).toEqual([]);
    // Start a new lesson forgets it and returns to the question form.
    fireEvent.click(screen.getByRole("button", { name: /Start a new lesson/ }));
    expect(
      screen.getByLabelText(/What would you like to explore/),
    ).toBeTruthy();
    expect(localStorage.getItem("explainback-studio-draft")).toBeNull();
  });
  it("remembers a created draft across a remount and makes no request on reopening", async () => {
    const posted: string[] = [];
    const post: Post = async (path) => {
      posted.push(path);
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        return {
          status: "ready",
          lesson: coolingLesson(),
          message: { en: "", zh: "" },
          attemptsRemaining: 7,
        } as never;
      return { records: [] } as never;
    };
    const first = mount({ authenticated: true, status, view: "create" }, post);
    fireEvent.change(screen.getByLabelText(/What would you like to explore/), {
      target: { value: "Cooling coffee" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create a lesson/ }));
    await screen.findByText(/Draft ready/);
    fireEvent.click(screen.getByRole("checkbox", { name: /reviewed/i }));
    await waitFor(() =>
      expect(localStorage.getItem("explainback-studio-draft")).toMatch(
        /"reviewed":true/,
      ),
    );
    first.unmount();
    posted.length = 0;
    mount({ authenticated: true, status, view: "create" }, post);
    expect(
      await screen.findByRole("heading", { name: "Cooling coffee" }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("checkbox", { name: /reviewed/i }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(posted.filter((c) => c.startsWith("/api/studio"))).toEqual([]);
  });
  it("does not restore a private draft while signed out", async () => {
    const { saveStudio } = await import("../lib/studio-store");
    saveStudio({
      draft: coolingLesson() as unknown as Lesson,
      topic: "",
      creation: "generated",
      reviewed: false,
      revisionPrompt: "",
      compose: null,
      revise: null,
      tryout: null,
      show: null,
      guide: {},
      explanations: {},
      player: null,
      presenting: false,
      pace: "off",
    });
    mount({ view: "create" });
    expect(
      screen.queryByRole("heading", { name: "Cooling coffee" }),
    ).toBeNull();
    expect(screen.getByText(/Lesson creation is available/)).toBeTruthy();
  });
});

describe("Guided replay", () => {
  it("advances predict → experiment → explain → transfer on its own, pauses on a manual click and resumes", async () => {
    let now = 0;
    const raf = vi.fn((cb: FrameRequestCallback) => {
      now += 200;
      return window.setTimeout(() => cb(now), 16) as unknown as number;
    });
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", (id: number) =>
      window.clearTimeout(id),
    );
    try {
      const { calls } = mount({ lessonId: "cooling" });
      await screen.findByRole("heading", { name: /cooling/i });
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const section = document.querySelector(".lesson-player")!;
      expect(section.getAttribute("data-stage")).toBe("predict");
      fireEvent.change(screen.getByLabelText(/Guided replay/), {
        target: { value: "fast" },
      });
      // Predict: dwell 4 s × 0.5, then "not sure" is chosen and the claim is tested.
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(section.getAttribute("data-stage")).toBe("experiment");
      // The experiment plays itself (6 s × 0.5 at 200 ms per frame), then dwells.
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      expect(section.getAttribute("data-progress")).toBe("1");
      await act(async () => {
        vi.advanceTimersByTime(1400);
      });
      expect(section.getAttribute("data-stage")).toBe("explain");
      // A manual click takes over; nothing advances until Resume.
      fireEvent.click(
        screen.getByRole("button", { name: /Replay experiment/ }),
      );
      expect(section.getAttribute("data-stage")).toBe("experiment");
      expect(
        screen.getByRole("button", { name: /Resume replay/ }),
      ).toBeTruthy();
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(section.getAttribute("data-stage")).toBe("experiment");
      fireEvent.click(screen.getByRole("button", { name: /Resume replay/ }));
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      await act(async () => {
        vi.advanceTimersByTime(1400);
      });
      expect(section.getAttribute("data-stage")).toBe("explain");
      await act(async () => {
        vi.advanceTimersByTime(4100);
      });
      expect(section.getAttribute("data-stage")).toBe("transfer");
      await act(async () => {
        vi.advanceTimersByTime(3100);
      });
      expect(section.getAttribute("data-stage")).toBe("complete");
      expect(screen.getByText(/Guided replay finished/)).toBeTruthy();
      expect(calls.filter((c) => c.startsWith("/api/studio"))).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe("Judge path", () => {
  it("runs draft, tryout, show, illustration, save and share in order, reusing what is already there", async () => {
    const calls: string[] = [];
    const slide = (kind: string) => ({
      kind,
      chapter: 0,
      heading: { en: kind + " heading", zh: kind },
      narration: { en: "Spoken " + kind + ".", zh: kind },
    });
    let shared = false;
    const bodies: Record<string, unknown>[] = [];
    const post: Post = async (path, body) => {
      calls.push(path);
      bodies.push({ path, ...(body as Record<string, unknown>) });
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        return {
          status: "ready",
          lesson: coolingLesson(),
          message: { en: "", zh: "" },
          attemptsRemaining: 7,
          model: "test",
          elapsedMs: 900,
          usage: null,
        } as never;
      if (path === "/api/studio/tryout")
        return {
          chapters: [
            {
              prediction: "disagree",
              reason: "r",
              explanation: "e",
              transfer: { answer: "18", correct: true, unit: "m" },
              confusions: [],
              suggestions: ["Label the axis."],
            },
          ],
          overall: "ok",
          rating: 4,
          llm: status.models[0],
          attemptsRemaining: 6,
          model: "test",
          elapsedMs: 800,
          usage: null,
        } as never;
      if (path === "/api/studio/show")
        return {
          show: {
            version: 1,
            slides: [
              slide("cover"),
              slide("claim"),
              slide("experiment"),
              { ...slide("takeaway"), illustrate: true },
            ],
            coverPrompt: "A mug",
          },
          cover: "data:image/webp;base64,QUJD",
          coverModel: "muse-image-1.0",
          illustrationsSkipped: 1,
          llm: status.models[0],
          attemptsRemaining: 5,
          model: "test",
          elapsedMs: 3000,
          usage: null,
        } as never;
      if (path === "/api/studio/illustrate")
        return {
          image: "data:image/webp;base64,QUJE",
          model: "muse-image-1.0",
          slide: 1,
          prompt: "p",
          llm: status.models[0],
          attemptsRemaining: 4,
          elapsedMs: 2000,
          usage: null,
        } as never;
      if (path === "/api/lessons")
        return {
          id: "0123456789abcdef",
          title: coolingLesson().title,
          intro: coolingLesson().intro,
          kind: "model",
          hasShow: true,
          model: "test",
          cover: "data:image/webp;base64,QUJD",
          sketch: null,
          shared,
          createdAt: 1,
          updatedAt: 2,
        } as never;
      if (path === "/api/lessons/share") {
        shared = true;
        return {
          id: "0123456789abcdef",
          title: coolingLesson().title,
          intro: coolingLesson().intro,
          kind: "model",
          hasShow: true,
          model: "test",
          cover: null,
          sketch: null,
          shared: true,
          createdAt: 1,
          updatedAt: 3,
        } as never;
      }
      return { records: [], lessons: [], limit: 50 } as never;
    };
    mount(
      {
        authenticated: true,
        status: { ...status, images: true },
        view: "create",
      },
      post,
    );
    expect(
      screen.getByRole("heading", { name: "The six-minute tour" }),
    ).toBeTruthy();
    expect(document.querySelector(".judge-foot")?.textContent).toMatch(
      /remaining steps will make: 4 · Used in this session: 0/,
    );
    fireEvent.click(screen.getByRole("button", { name: /Run all remaining/ }));
    await screen.findByText(/All steps done/, undefined, { timeout: 8000 });
    const studio = calls.filter(
      (c) => c.startsWith("/api/studio/") && c !== "/api/studio/session",
    );
    expect(studio).toEqual([
      "/api/studio/compose",
      "/api/studio/tryout",
      "/api/studio/show",
      "/api/studio/illustrate",
    ]);
    // The illustration step draws the slide the writer flagged but the show had no time for.
    expect(bodies.find((b) => b.path === "/api/studio/illustrate")?.slide).toBe(
      3,
    );
    expect(calls.filter((c) => c === "/api/lessons")).toHaveLength(1);
    expect(calls.filter((c) => c === "/api/lessons/share")).toHaveLength(1);
    expect(
      document.querySelectorAll('.judge-steps li[data-state="done"]'),
    ).toHaveLength(6);
    expect(document.querySelector(".judge-foot")?.textContent).toMatch(
      /Used in this session: 4/,
    );
    expect(
      await screen.findByRole("button", { name: "Tour complete" }),
    ).toBeTruthy();
  });
  it("marks the illustration step unavailable without an image model and shows no run-all for a single step", () => {
    mount({ authenticated: true, status, view: "create" });
    const steps = document.querySelectorAll(".judge-steps li");
    expect(steps[3].getAttribute("data-state")).toBe("unavailable");
    expect(steps[3].textContent).toMatch(/Not on this server/);
    expect(
      screen.getByRole("button", { name: /Run next: Draft a lesson/ }),
    ).toBeTruthy();
  });
});

describe("Reopening a saved lesson", () => {
  it("restores the learner tryout and an explain-back grade without any provider request", async () => {
    const lesson = coolingLesson();
    shelf.record = {
      id: "0123456789abcdef",
      title: lesson.title,
      intro: lesson.intro,
      kind: "model",
      hasShow: false,
      hasTryout: true,
      graded: 1,
      model: "test",
      cover: null,
      sketch: null,
      shared: false,
      createdAt: 1,
      updatedAt: 2,
      lesson,
      show: null,
      coverModel: null,
      illustrations: {},
      tryout: {
        chapters: [
          {
            prediction: "disagree",
            reason: "The gap shrinks.",
            explanation: "Cooling follows the gap.",
            transfer: {
              given: "18",
              correct: true,
              type: "number",
              unit: "°C",
            },
            confusions: [],
            suggestions: ["Label the axis."],
          },
        ],
        overall: "Short and clear.",
        rating: 4,
        model: "test",
        language: "en",
      },
      grades: {
        "0": {
          explanation: "It cools faster when hotter.",
          feedback: "Right: the rate follows the gap.",
          verdict: "supported",
          followUp: "What happens near room temperature?",
          model: "test",
          language: "en",
          key: "abc-1",
        },
      },
    };
    const calls: string[] = [];
    const post: Post = async (path) => {
      calls.push(path);
      return { records: [] } as never;
    };
    mount({ authenticated: true, status, view: "create" }, post);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    await screen.findByText(/Short and clear\./);
    expect(document.querySelector(".tryout-report")?.textContent).toMatch(
      /4\/5/,
    );
    expect(calls.filter((c) => c.startsWith("/api/studio"))).toEqual([]);
    // The restored grade is part of the remembered draft, so it survives a reload too.
    await vi.waitFor(() => {
      const stored = localStorage.getItem("explainback-studio-draft") ?? "";
      expect(stored).toMatch(/It cools faster when hotter\./);
      expect(stored).toMatch(/"verdict":"supported"/);
      expect(stored).toMatch(/Short and clear\./);
    });
    shelf.record = null;
  });
});

describe("Failure states", () => {
  const compose =
    (error: () => never): Post =>
    async (path) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose") error();
      return { records: [] } as never;
    };
  const create = async () => {
    fireEvent.change(
      screen.getByLabelText(/What would you like to explore|你想/),
      { target: { value: "Cooling" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Create a lesson|创建/ }),
    );
  };
  it("explains a used-up hourly budget in the viewer's language instead of the generic line", async () => {
    mount(
      { authenticated: true, status, view: "create", language: "zh" },
      compose(() => {
        throw new ApiError(
          "This access code’s hourly request budget is used up.",
          429,
        );
      }),
    );
    await create();
    await screen.findByText(/每小时请求额度已用完/);
    expect(screen.queryByText(/hourly request budget/)).toBeNull();
  });
  it("names a reset session and an unconfigured model", async () => {
    const { unmount } = mount(
      { authenticated: true, status, view: "create" },
      compose(() => {
        throw new ApiError("Session was reset; response discarded.", 409);
      }),
    );
    await create();
    await screen.findByText(/still in progress or the session was reset/);
    unmount();
    mount(
      { authenticated: true, status, view: "create" },
      compose(() => {
        throw new ApiError("The selected model is not configured.", 503);
      }),
    );
    await create();
    await screen.findByText(/not configured on the server/);
  });
  it("says when a show came back without a cover for lack of time", async () => {
    const slide = (kind: string) => ({
      kind,
      chapter: 0,
      heading: { en: kind, zh: kind },
      narration: { en: "Spoken " + kind + ".", zh: kind },
    });
    const post: Post = async (path) => {
      if (path === "/api/studio/session")
        return { sessionId: "s1", attemptsRemaining: 8 } as never;
      if (path === "/api/studio/compose")
        return {
          status: "ready",
          lesson: coolingLesson(),
          message: { en: "", zh: "" },
          attemptsRemaining: 7,
          model: "test",
          elapsedMs: 900,
          usage: null,
        } as never;
      if (path === "/api/studio/show")
        return {
          show: {
            version: 1,
            slides: [
              slide("cover"),
              slide("claim"),
              slide("experiment"),
              slide("takeaway"),
            ],
            coverPrompt: "A mug",
          },
          cover: null,
          coverModel: null,
          coverSkipped: "time",
          llm: status.models[0],
          attemptsRemaining: 6,
          model: "test",
          elapsedMs: 50000,
          usage: null,
        } as never;
      return { records: [] } as never;
    };
    mount(
      {
        authenticated: true,
        status: { ...status, images: true },
        view: "create",
      },
      post,
    );
    await create();
    await screen.findByText(/Draft ready/);
    fireEvent.click(
      screen.getByRole("button", { name: /Make a narrated show/ }),
    );
    await screen.findByText(/no time left in this request for a cover/);
    expect(
      await screen.findByRole("button", { name: "Draw a cover" }),
    ).toBeTruthy();
  });
  it("tells the judge path why it cannot run when the session budget is gone", () => {
    const post: Post = async () => ({ records: [] }) as never;
    mount({ authenticated: true, status, view: "create" }, post);
    expect(document.querySelector(".judge-foot")?.textContent).toMatch(
      /Requests the remaining steps will make/,
    );
  });
});

describe("Sketch provenance notes", () => {
  const sketch = "data:image/png;base64,iVBORw0KGgo=";
  it("keeps the gallery note for the library's sketch lesson", async () => {
    mount({ lessonId: "sketch-pendulum" });
    expect(
      await screen.findByText(
        /Drafted by Meta muse-spark-1.3 from this hand-drawn sketch/,
      ),
    ).toBeTruthy();
    expect(document.querySelector(".spotlight img")).toBeTruthy();
  });
  it("does not describe a shared lesson's sketch as the gallery's pendulum", async () => {
    const lesson = coolingLesson() as unknown as Lesson;
    mount({
      lessonId: "0123456789abcdef",
      external: {
        id: "0123456789abcdef",
        title: lesson.title,
        intro: lesson.intro,
        kind: "model",
        hasShow: false,
        hasTryout: false,
        graded: 0,
        model: "muse-wonder-1.0",
        cover: null,
        sketch,
        shared: true,
        createdAt: 1,
        updatedAt: 2,
        lesson,
        show: null,
        coverModel: null,
        illustrations: {},
        tryout: null,
        grades: {},
      },
    });
    expect(await screen.findByText(/Shared by its creator/)).toBeTruthy();
    expect(screen.queryByText(/October 28, 2026/)).toBeNull();
    expect(
      (document.querySelector(".spotlight img") as HTMLImageElement | null)
        ?.src,
    ).toBe(sketch);
  });
});

describe("Display units", () => {
  beforeEach(() => localStorage.clear());
  it("shows the cooling lesson in °F on request, checks the answer in the authored unit and remembers the choice", async () => {
    mount({ lessonId: "cooling" });
    expect(
      await screen.findByRole("heading", { name: /Newton cooling/ }),
    ).toBeTruthy();
    expect(screen.getByText(/Initial temperature/).textContent).toContain("°C");
    fireEvent.click(screen.getByRole("button", { name: /US \(°F, ft, lb\)/ }));
    expect(screen.getByText(/Initial temperature/).textContent).toContain("°F");
    expect(screen.getByText(/140 → 212/)).toBeTruthy();
    expect(
      (screen.getByLabelText(/Initial temperature \(°F\)/) as HTMLInputElement)
        .value,
    ).toBe("176");
    // Typing a Fahrenheit value moves the authored slider to the nearest whole degree Celsius.
    const field = screen.getByLabelText(
      /Initial temperature \(°F\)/,
    ) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "185" } });
    fireEvent.blur(field);
    expect(
      (screen.getByLabelText(/Initial temperature slider/) as HTMLInputElement)
        .value,
    ).toBe("85");
    fireEvent.click(screen.getByRole("button", { name: /^Disagree$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Test this claim/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show final state/ }));
    expect(screen.getByText(/Temperature/, { selector: "dt" })).toBeTruthy();
    expect(
      document.querySelector(".experiment-metrics dd")?.textContent,
    ).toContain("°F");
    fireEvent.click(screen.getByRole("button", { name: /Explain the result/ }));
    fireEvent.click(screen.getByRole("button", { name: /Try a fresh case/ }));
    expect(
      screen.getByText(
        /Initial temperature = 194 °F · Room temperature = 59 °F/,
      ),
    ).toBeTruthy();
    // The transfer answer: 15 + 75·e^(−0.5) °C, typed in °F.
    const celsius = 15 + 75 * Math.exp(-0.5);
    const fahrenheit = (celsius * 9) / 5 + 32;
    fireEvent.change(screen.getByLabelText(/Your answer \(°F\)/), {
      target: { value: fahrenheit.toFixed(1) },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Check answer locally/ }),
    );
    expect(await screen.findByText(/That matches this model/)).toBeTruthy();
    expect(localStorage.getItem("explainback.units")).toBe("us");
  });
});
