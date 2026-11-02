# Lesson canvas

Attach a sketch or photo in Create and request a numeric lesson. The existing creator model proposes the lesson and its bounded controls/formulas. A process lesson keeps the ordinary process player; an image does not justify inventing a quantitative model.

In draft review, the canvas editor connects one image region to one existing control per model chapter (a process lesson has no canvas editor):

1. Name an object and explicitly request SAM 3.1 suggestions, or select a region yourself. Drag a rectangle, select a suggestion with the mouse or keyboard, or use **Select whole image**.
2. Choose the control and **Confirm connection**. This is a creator's teaching decision, not a measurement or a relationship verified by SAM.
3. Review the formulas, assumptions and teaching text before presenting. Confirming or removing a connection clears the lesson's review checkbox.

The learner sees the source image and confirmed region alongside the experiment. The object button focuses its control. On the prediction step of a chapter with a confirmed connection, they can draw one curve or enter start/middle/end values with the keyboard; without a connection the ordinary agree/disagree/not-sure step is shown. A new gesture replaces the previous curve; Clear removes it. The prediction is optional, so the existing agree/disagree/not-sure path also works. Revealing the experiment locks the dashed prediction beside the solid calculated curve. The graph stays in authored units, labeled explicitly, while existing numeric controls can display converted units.

Explain-back sends the learner's text and optional drawing through the existing authenticated guide request. Spark receives the prediction alongside numeric comparisons recomputed on the server using the same graph bounds and bounded experiment engine. The client never supplies trusted calculated answers. These comparisons establish agreement with authored formulas only; neither the formulas nor the feedback are independently verified science or evidence of teaching effectiveness. Voice continues to produce editable explanation text through the existing transcription action.

## Data and recovery

- Generated model chapters may have `canvas: { concept, input, box: { x, y, width, height } }`. Region fractions must be finite, inside the source image and nonempty; the input must exist. Older lessons remain valid without this field. Model response schemas do not ask the author model to create confirmed connections.
- Drawings contain 2–128 finite normalized graph points. SVG pointer capture handles mouse, pen and touch; canceled gestures discard the partial stroke. Long gestures are reduced to stay bounded. The server rejects oversized, malformed and nonnumeric-model drawings.
- Browser draft storage remembers the source image and up to 24 drawing contexts. Contexts include the chapter definition, control values, output and preset, so incompatible drawings do not follow changed settings. Language and playback progress do not change the drawing context. Feedback fingerprints additionally include the drawing and explanation.
- Confirmed bindings travel with lesson JSON and therefore with the existing save/share/export paths. Source images use existing Blob storage when saving; without that storage, the app explains that images are not kept. Exported lesson JSON contains the connection but not image bytes. Learner drawings stay in the browser and are not added to public saved/shared records.
- Editing a definition keeps a binding only while its target remains a numeric control; otherwise the connection is removed with a notice so the valid definition can still be applied. Changing graph output clears earlier feedback and returns a canvas lesson to prediction for the newly selected quantity.
- A source image is retained for a model revision, but a newly generated chapter needs its connection confirmed again. A new lesson clears the old source and predictions. Browser storage failures degrade to the current session; if the storage quota is exceeded, recovery first omits show and source image bytes while retaining the lesson.

This feature adds no dependencies, execution tools or API routes. The model calls remain explicit: creation, optional SAM detection, optional explain-back feedback and optional voice transcription.
