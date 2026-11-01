import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { CanvasBindingEditor } from "./CanvasBindingEditor";
import { PredictionCanvas } from "./PredictionCanvas";
import { LessonPlayer } from "./LessonPlayer";
import { coolingLesson } from "../../test-support/generated-lessons.mjs";
import { chapterExperiment, createLessonPlayer } from "../lib/shared";
import type {
  CanvasBinding,
  Chapter,
  Drawing,
  ModelDemo,
  Feedback,
  Lesson,
} from "../lib/types";

afterEach(cleanup);
const demo = coolingLesson().chapters[0].demo as ModelDemo;
it("switching a canvas output clears old feedback and starts a new prediction", () => {
  const lesson = coolingLesson() as Lesson;
  const chapter = lesson.chapters[0];
  chapter.canvas = {
    concept: "cup",
    input: "initial",
    box: { x: 0, y: 0, width: 1, height: 1 },
  };
  (chapter.demo as ModelDemo).outputs.push({
    id: "gap",
    label: { en: "Temperature gap", zh: "温差" },
    unit: "°C",
    expression: "temp - ambient",
  });
  const player = createLessonPlayer(lesson);
  player.predict("agree");
  player.next();
  player.scrub(1);
  player.next();
  function Harness() {
    const [feedback, setFeedback] = useState<Feedback | null>({
      explanation: "Old temperature feedback",
      nextAction: "replay",
      attemptsRemaining: 5,
    });
    return (
      <LessonPlayer
        player={player}
        language="en"
        visible
        busy={false}
        canAsk
        feedback={feedback}
        onGuide={() => {}}
        onClearFeedback={() => setFeedback(null)}
        onBack={() => {}}
        onLibrary={() => {}}
      />
    );
  }
  render(<Harness />);
  expect(screen.getByText("Old temperature feedback")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Graph output"), {
    target: { value: "1" },
  });
  expect(screen.queryByText("Old temperature feedback")).toBeNull();
  expect(player.state.stage).toBe("predict");
  expect(player.state.metric).toBe(1);
  expect(
    screen.getByRole("heading", { name: "Sketch your prediction" }),
  ).toBeTruthy();
});
it("requires confirmation before connecting a SAM region to a model control", () => {
  let confirmed: CanvasBinding | undefined;
  render(
    <CanvasBindingEditor
      language="en"
      image="/gallery/pendulum-sketch.png"
      demo={demo}
      onChange={(value) => {
        confirmed = value;
      }}
      detection={{
        concept: "cup",
        width: 100,
        height: 100,
        model: "sam-3.1",
        boxes: [{ x1: 10, y1: 20, x2: 49, y2: 69 }],
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Select cup 1" }));
  expect(confirmed).toBeUndefined();
  fireEvent.change(screen.getByLabelText("Connect to control"), {
    target: { value: "ambient" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm connection" }));
  expect(confirmed).toMatchObject({
    concept: "cup",
    input: "ambient",
    box: { x: 0.1, y: 0.2, width: 0.4 },
  });
  expect(confirmed?.box.height).toBeCloseTo(0.5);
});
it("can create a connection without a segmentation request", () => {
  let confirmed: CanvasBinding | undefined;
  render(
    <CanvasBindingEditor
      language="zh"
      image="/gallery/pendulum-sketch.png"
      demo={demo}
      onChange={(v) => {
        confirmed = v;
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "选择整张图片" }));
  fireEvent.change(screen.getByLabelText("物体名称"), {
    target: { value: "杯子" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认关联" }));
  expect(confirmed?.box).toEqual({ x: 0, y: 0, width: 1, height: 1 });
});
it("supports keyboard point entry, preserves the prediction for comparison, and locks it after reveal", () => {
  const e = chapterExperiment(coolingLesson().chapters[0] as Chapter, 0, "en");
  function Harness({ preview = true }: { preview?: boolean }) {
    const [drawing, setDrawing] = useState<Drawing | null>(null);
    return (
      <PredictionCanvas
        language="en"
        experiment={e}
        drawing={drawing}
        onChange={setDrawing}
        preview={preview}
        progress={preview ? 0 : 1}
      />
    );
  }
  const view = render(<Harness />);
  fireEvent.change(screen.getByLabelText("Start prediction"), {
    target: { value: "80" },
  });
  fireEvent.change(screen.getByLabelText("Middle prediction"), {
    target: { value: "50" },
  });
  fireEvent.change(screen.getByLabelText("End prediction"), {
    target: { value: "20" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use these points" }));
  expect(document.querySelector(".prediction-path")).not.toBeNull();
  expect(document.querySelector(".calculated-curve")).toBeNull();
  view.rerender(<Harness preview={false} />);
  expect(document.querySelector(".prediction-path")).not.toBeNull();
  expect(document.querySelector(".calculated-curve")).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Use these points" })).toBeNull();
});
it("does not accept invalid keyboard coordinates or expose drawing controls while busy", () => {
  const change = vi.fn();
  const e = chapterExperiment(coolingLesson().chapters[0] as Chapter, 0, "en");
  const view = render(
    <PredictionCanvas
      language="en"
      experiment={e}
      drawing={null}
      onChange={change}
      preview
      progress={0}
    />,
  );
  fireEvent.change(screen.getByLabelText("End prediction"), {
    target: { value: "9999" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use these points" }));
  expect(change).not.toHaveBeenCalled();
  view.rerender(
    <PredictionCanvas
      language="en"
      experiment={e}
      drawing={null}
      onChange={change}
      preview
      progress={0}
      busy
    />,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Use these points",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
