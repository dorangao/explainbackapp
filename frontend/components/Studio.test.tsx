import { afterEach, describe, expect, it, vi } from "vitest";
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
vi.mock("../lib/recorder", () => ({
  MicrophoneError: class extends Error {},
  startRecording: vi.fn(async () => ({
    stop: async () => ({ wav: new Blob(["pcm"]), durationMs: 1500 }),
  })),
  blobToBase64: async () => "QUJD",
}));
import type { Post, Status } from "../lib/types";
import { ApiError } from "../lib/api";
import {
  coolingLesson,
  processLesson,
} from "../../test-support/generated-lessons.mjs";

afterEach(cleanup);
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
