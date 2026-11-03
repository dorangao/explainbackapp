# Lesson canvas

## Try it with a lesson

Choose **Try the canvas** on the Library page to open **Pendulum sketch: length and swing** (`#lesson:sketch-pendulum`). No sign-in or model request is needed. Draw the period you expect as length increases, or open **Enter three points with the keyboard** and enter 0.6, 1.8 and 2.8 seconds. Choose Agree, Disagree or Not sure, then **Test this claim**, **Show final state** and **Explain the result** to compare the dashed prediction with the solid model curve. Changing gravity starts a prediction for the new settings. These example points are a learner prediction, not measured data.

Every numeric model lesson offers prediction drawing, including older lessons without an image or confirmed picture connection. Process explorers and catalog simulations keep their existing players. Drawing is optional; the Agree/Disagree/Not sure path remains available. The graph uses authored units even when numeric controls display converted units. Model feedback still requires sign-in and an explicit request.

## Connect a picture as a creator

Attach a sketch or photo in Create and request a numeric lesson. The existing creator model proposes the lesson and its bounded controls/formulas. A process lesson keeps the ordinary process player; an image does not justify inventing a quantitative model.

In draft review, the canvas editor connects one image region to one existing control per model chapter (a process lesson has no canvas editor):

1. Name an object and explicitly request SAM 3.1 suggestions, or select a region yourself. Drag a rectangle, select a suggestion with the mouse or keyboard, or use **Select whole image**.
2. Choose the control and **Confirm connection**. This is a creator's teaching decision, not a measurement or a relationship verified by SAM.
3. Review the formulas, assumptions and teaching text before presenting. Confirming or removing a connection clears the lesson's review checkbox.

The learner sees an available source image alongside the controls. A confirmed region adds an object button that focuses its control; an image connection is not required to draw. On the prediction step, they can draw one curve or enter start/middle/end values with the keyboard. A new gesture replaces the previous curve; Clear removes it. Revealing the experiment locks the dashed prediction beside the solid calculated curve.

Explain-back sends the learner's text and optional drawing through the existing authenticated guide request. Spark receives the prediction alongside numeric comparisons recomputed on the server using the same graph bounds and bounded experiment engine. The client never supplies trusted calculated answers. These comparisons establish agreement with authored formulas only; neither the formulas nor the feedback are independently verified science or evidence of teaching effectiveness. Voice continues to produce editable explanation text through the existing transcription action.

## Data and recovery

- Generated model chapters may have `canvas: { concept, input, box: { x, y, width, height } }`. Region fractions must be finite, inside the source image and nonempty; the input must exist. Older lessons remain valid without this field. Model response schemas do not ask the author model to create confirmed connections.
- Drawings contain 2–128 finite normalized graph points. SVG pointer capture handles mouse, pen and touch; canceled gestures discard the partial stroke. Long gestures are reduced to stay bounded. The server rejects oversized, malformed and nonnumeric-model drawings.
- Browser draft storage remembers the source image and up to 24 drawing contexts. Contexts include the chapter definition, control values, output and preset, so incompatible drawings do not follow changed settings. Language and playback progress do not change the drawing context. Feedback fingerprints additionally include the drawing and explanation.
- Confirmed bindings travel with lesson JSON and therefore with the existing save/share/export paths. Source images use existing Blob storage when saving; without that storage, the app explains that images are not kept. Exported lesson JSON contains the connection but not image bytes. Learner drawings stay in the browser and are not added to public saved/shared records.
- Editing a definition keeps a binding only while its target remains a numeric control; otherwise the connection is removed with a notice so the valid definition can still be applied. Changing graph output clears earlier feedback and returns a canvas lesson to prediction for the newly selected quantity.
- A source image is retained for a model revision. A creator-confirmed connection is carried forward only when its complete numeric demo definition matches exactly and uniquely in both the old and revised lesson, regardless of object-key order or chapter order. Text-only lesson/chapter edits can retain it; changes to controls, formulas or other demo fields, duplicate matches and new demos require a new confirmation. Model replies cannot create or replace creator confirmation. The revision status reports removed connections, and the EN/ZH diff includes the object, control and image region for connection additions, removals and edits. The revised lesson still requires review. A new lesson clears the old source and predictions. Browser storage failures degrade to the current session; if the storage quota is exceeded, recovery first omits show and source image bytes while retaining the lesson.

This feature adds no dependencies, execution tools or API routes. The model calls remain explicit: creation, optional SAM detection, optional explain-back feedback and optional voice transcription.
