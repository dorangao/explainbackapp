import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ShowPlayer } from "./ShowPlayer";
import type { Lesson, Show } from "../lib/types";
import { coolingLesson } from "../../test-support/generated-lessons.mjs";

afterEach(cleanup);
const bi = (en: string, zh: string) => ({ en, zh });
const show: Show = {
  version: 1,
  coverPrompt: "A mug",
  slides: [
    {
      kind: "cover",
      chapter: 0,
      heading: bi("Why coffee waits", "咖啡为何等待"),
      narration: bi("Spoken cover.", "封面旁白。"),
    },
    {
      kind: "claim",
      chapter: 0,
      heading: bi("The claim", "观点"),
      narration: bi("Spoken claim.", "观点旁白。"),
    },
    {
      kind: "experiment",
      chapter: 0,
      heading: bi("Watch the curve", "看曲线"),
      narration: bi("Spoken experiment.", "实验旁白。"),
    },
    {
      kind: "evidence",
      chapter: 0,
      heading: bi("What it shows", "结果"),
      narration: bi("Spoken evidence.", "证据旁白。"),
    },
    {
      kind: "takeaway",
      chapter: 0,
      heading: bi("Takeaway", "要点"),
      narration: bi("Spoken takeaway.", "要点旁白。"),
    },
  ],
};
type Utterance = { text: string; lang: string; onend: (() => void) | null };
let spoken: Utterance[] = [];
beforeEach(() => {
  spoken = [];
  class FakeUtterance {
    text: string;
    lang = "";
    rate = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", {
    speak: (u: Utterance) => spoken.push(u),
    cancel: () => {},
    getVoices: () => [{ lang: "zh-CN" }],
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("ShowPlayer", () => {
  it("renders the cover, steps through slides, animates the experiment and credits the models", () => {
    const onClose = vi.fn();
    render(
      <ShowPlayer
        lesson={coolingLesson() as unknown as Lesson}
        show={show}
        cover="data:image/webp;base64,QUJD"
        language="en"
        scriptModel="muse-wonder-1.0"
        coverModel="muse-image-1.0"
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Cooling coffee",
    );
    expect(document.querySelector(".show-cover img")?.getAttribute("src")).toBe(
      "data:image/webp;base64,QUJD",
    );
    expect(screen.getByText("Spoken cover.")).toBeTruthy();
    expect(screen.getByText(/1 \/ 5/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next slide/ }));
    expect(screen.getByText("Spoken claim.")).toBeTruthy();
    expect(document.querySelector(".show-claim")?.textContent).toMatch(
      /exponential|temperature/i,
    );
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Spoken experiment.")).toBeTruthy();
    expect(document.querySelector(".show-experiment")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector(".show-evidence dd")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Spoken takeaway.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Next slide/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(document.querySelector(".show-credits")?.textContent).toMatch(
      /muse-wonder-1.0.*muse-image-1.0.*voice by your browser/,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
  it("speaks the narration in the chosen language while playing and advances when it ends", () => {
    render(
      <ShowPlayer
        lesson={coolingLesson() as unknown as Lesson}
        show={show}
        cover={null}
        language="zh"
        scriptModel={null}
        coverModel={null}
        onClose={() => {}}
      />,
    );
    expect(document.querySelector(".show-cover img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /播放/ }));
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe("封面旁白。");
    expect(spoken[0].lang).toBe("zh-CN");
    act(() => spoken[0].onend?.());
    expect(screen.getByText("观点旁白。")).toBeTruthy();
    expect(spoken).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /暂停/ }));
    expect(screen.getByRole("button", { name: /播放/ })).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/浏览器朗读/));
    fireEvent.click(screen.getByRole("button", { name: /播放/ }));
    expect(spoken).toHaveLength(2);
  });
});

describe("ShowPlayer pace", () => {
  it("pauses playback on a manual step, reports the pace and shows progress", () => {
    const onPace = vi.fn();
    render(
      <ShowPlayer
        lesson={coolingLesson() as unknown as Lesson}
        show={show}
        cover={null}
        language="en"
        scriptModel={null}
        coverModel={null}
        onClose={() => {}}
        pace="fast"
        onPace={onPace}
      />,
    );
    expect((screen.getByLabelText(/Pace/) as HTMLSelectElement).value).toBe(
      "fast",
    );
    fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe("Spoken cover.");
    fireEvent.click(screen.getByRole("button", { name: /Next slide/ }));
    expect(screen.getByText("Spoken claim.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Play$/ })).toBeTruthy();
    expect(spoken).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(/Pace/), {
      target: { value: "slow" },
    });
    expect(onPace).toHaveBeenCalledWith("slow");
    expect(
      (screen.getByLabelText(/Replay progress/) as HTMLProgressElement).value,
    ).toBeCloseTo(1 / 5, 5);
  });
});
