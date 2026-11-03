# Lesson postcards: pretty cards that carry the essence of a lesson

Design, November 3, 2026 Pacific. Nothing in this document is implemented. It describes a
new output of a saved lesson: one or more **postcards**, each a single pretty image-sized
composition that captures the essence of the lesson (its claim, what the experiment showed,
the explanation in a sentence, and a question to take away), drawn by code from a preset
and optionally worded by Muse and decorated with Muse Image art. Once the work lands, the
behaviour sections move into `docs/lesson-library.md` and `docs/architecture.md`, and the
phase plan leaves this public repository.

The word *postcard* is used throughout because *card* is already taken twice in the code:
`.lesson-card` is the library tile (`frontend/components/Gallery.tsx`) and the "evaluation
card" is the document at `#evaluation`. Visible labels can still say **Cards** / **卡片**.

## 0. The idea in one paragraph

A lesson is long: Predict, Experiment, Explain, Transfer, a show, a report. A postcard is
the one screen a learner would pin on a wall or send to a friend: *"A hot cup does not cool
at a steady rate. The gap to the room shrinks, so the drop per minute shrinks."* with the
lesson's own curve beside it, a holiday or season on the border if the creator likes, the
lesson link at the bottom, and an honest line about who made what. A creator picks a
preset (one card, or a small set such as Predict / Test / Explain), the app fills it from
the saved lesson without any model request, the creator may then ask Muse to word it
better or draw a picture for it, edits the words, and saves. Visitors to a shared lesson
see the cards, open them full size, download a PNG, or print one. The creator or the
tester administrator can create, edit and delete cards; everyone else only reads.

## 1. What a postcard is

### Anatomy

Every postcard has the same six parts, in a layout the preset decides:

| Part | Content | Source | Limit |
| --- | --- | --- | --- |
| Headline | The claim (model lesson) or the stage question (process lesson), or a creator rewrite | `chapter.demo.claim`, or the chapter framing | 80 characters per language |
| Essence | One or two sentences: what the experiment showed and why | `chapter.explanation`, or the show's `takeaway` narration, or Muse wording | 200 |
| Question | A take-away question the reader can answer without the app | the chapter's `transfer` question, or Muse wording | 120 |
| Panel | A picture: the lesson's own chart drawn by code, the show cover, a slide illustration, a new drawing for this card, or nothing | see §3 | one image, ≤ 1.5 MB in Blob |
| Footer | Lesson title, `explainback.app` with the shared link, language, date | code | not editable |
| Provenance line | Who made which part: creator / Muse Spark / Muse Image / administrator | code | not editable |

The headline, essence and question are **bilingual** (`{en, zh}`) like every lesson text,
so one stored card renders in either language and the "bilingual pair" preset shows both.

### Formats

| Format | Pixels | For |
| --- | --- | --- |
| `landscape` | 1200 × 630 | links, chat, slides, the Open Graph preview in §6 |
| `portrait` | 1080 × 1350 | phone screens, stories |
| `square` | 1080 × 1080 | feeds |
| `print` | 1748 × 1240 (A6 at 300 dpi, 148 × 105 mm) | a paper postcard |

The composition is one SVG with a fixed `viewBox`; the format only changes the viewBox and
the preset's layout slots. The same SVG is what the page shows, what the PNG export
rasterises and what a print stylesheet prints, so the three never disagree.

### Rules that carry over from the rest of the app

1. **Code marks numbers; the model comments on wording.** Any figure on a card (the curve,
   a value, a pair of readings) is drawn by code from the lesson's own computation. The
   Muse wording schema has no numeric fields, and the card text validator rejects a model
   reply that introduces a number that the lesson's shown values do not contain (the same
   string check `formatDemoNumber` makes possible for the leak guard in
   `docs/design/coached-stages.md`; it is a string check, not a semantic one).
2. **No model request is needed to make, save, share, list or delete a card.** The default
   fill is pure code. Muse wording and Muse Image art are optional, one request each, on
   the Lesson Studio session budget like every other model action.
3. **Nothing on a card is reviewed science.** The provenance line says so in the same
   words the library uses for creator-shared lessons, and it cannot be removed.
4. **Permissions come from the server.** Owner and administrator rights are decided by the
   existing `editable()`, `isAdmin` and `ownerOf` helpers in `src/lesson-routes.mjs` and
   `src/server.mjs`; no flag in a request body changes them.

## 2. Presets

A preset is a source-controlled object, never user data, in `public/card-presets.mjs` so
the browser renders from it and the server validates ids against the same list. Three
things compose: a **look** (palette, type, border, motif), a **layout** (where the six parts
go for each format), and a **set** (how many cards a preset creates and what each one
holds). The creator sees them as one picker with three rows: *Look*, *Set*, *Format*.

### Looks

| Look id | Palette | Motif (SVG drawn by code, no model) | Notes |
| --- | --- | --- | --- |
| `paper` | the app's Paper tokens (`--paper`, `--ink`, `--accent`) | thin rule, small ExplainBack mark | default |
| `glass`, `meta` | the other two app themes | same | matches the user's theme |
| `chalk` | dark slate, chalk white, one accent | hand-ruled frame | for dark feeds |
| `lunar-new-year` | vermilion, gold, ink | lanterns, a cloud scroll border | occasion |
| `mid-autumn` | indigo, moon ivory, osmanthus gold | moon and rabbit silhouette | occasion |
| `thanksgiving` | ochre, cranberry, cream | leaf border | occasion |
| `winter` | pine, snow, brass | snowflake corners | occasion |
| `spring` | leaf green, blossom pink | branch corner | occasion |
| `graduation` | navy, gold | cap and ribbon | occasion |
| `teachers-day` | warm paper, red stamp | stamp mark "explained back" | occasion |

Every look is a palette validated by a unit test for 4.5:1 contrast on headline and body
text and 3:1 on the footer, in both the light panel and the decorated border, so no card
ships unreadable. Motifs are vector art checked into the repository under
`public/card-motifs/`, drawn by hand or with a drawing tool, never generated at run time.
Occasion looks also carry a short bilingual **occasion phrase** ("for the Mid-Autumn
table", "新春快乐") that the footer may print and that the optional Muse wording may use in
one phrase (§3).

### Sets

| Set id | Cards | What each card holds | Panel |
| --- | --- | --- | --- |
| `essence` | 1 | claim as headline, explanation as essence, transfer question | chart of chapter 1 |
| `predict-test-explain` | 3 | **Predict**: the claim and a prediction prompt, no result shown; **Test**: the experiment and the chart, one sentence on what it showed; **Explain**: the explanation and the question | prediction sketch; chart; cover or illustration |
| `chapters` | 1 per chapter (≤ 3) | each chapter's claim, explanation, question | that chapter's chart |
| `bilingual-pair` | 2 | the essence card in English and in Chinese | chart |
| `cover` | 1 | title and intro only, large panel | show cover or new drawing |

A creator can hold at most **6 cards per lesson** (`MAX_CARDS_PER_LESSON`). Creating a set
that would exceed the cap is refused with the count, like the shelf cap.

The **Predict** card of `predict-test-explain` is the one place a card must not give the
answer away: its text is checked against the chapter's final metric values the way the
coached Predict stage is, and its panel is the empty prediction axes, never the result
curve.

### Layouts

Each format has one layout per look family (text-left/panel-right for landscape, panel
above text for portrait and square, a bleed border for print). Layout is data (slot
rectangles in viewBox units), so a new look rarely needs new layout code.

## 3. Filling a card

### Default fill: code only

`fillCards(lesson, show, preset, language)` in `frontend/lib/postcards.ts` (pure, no I/O,
unit-tested) returns the card records for a set from the saved lesson:

- headline ← `demo.claim` (model lesson), the first stage's framing (process), or the title
  (catalog); essence ← the chapter explanation (≤ 260 in the lesson, clipped to the first
  two sentences for the card); question ← the chapter's transfer question.
- panel ← `{kind: "chart", chapter}` when the chapter has a demo the engines can draw,
  else `{kind: "cover"}` when a cover exists, else `{kind: "none"}`.

The same function runs for gallery lessons, so a visitor can preview (not save) a card for
any reviewed lesson. That is phase 0 and needs no server change.

### Optional: Muse words it

**Request** `POST /api/studio/card-text`, signed in, own studio session, 48 KB body:

```json
{
  "sessionId": "…",
  "lesson": { "...": "the full lesson, validated server-side" },
  "chapter": 0,
  "role": "essence" | "predict" | "test" | "explain" | "cover",
  "language": "en",
  "occasion": "mid-autumn",
  "note": "for my daughter's class"
}
```

Code before the call: `validateLesson` passes; `role` is in the enum; `occasion` is a
known look id or absent; `note` is ≤ 120 characters with the same character ban as an
illustration `direction` (no `<>{}[]\``); one session attempt and one hourly unit are
spent first, as every Studio action is. The model is the tester role (Spark): this is
wording, not authorship, and Spark's 30 s deadline fits the 55 s request budget with room.

**What Muse receives.** The chapter's claim, framing, explanation and transfer question in
both languages, the show's takeaway narration if any, the role, the occasion phrase, and
the note. Never samples, metrics or the transfer answer; for `predict`, not the
explanation either. The instructions: write for a card, not a lesson; keep the science of
the explanation unchanged; use the occasion in at most one phrase and only outside the
essence; no numbers; both languages, each natural rather than a translation. Structured
output with one schema, `card_text`:

| Field | Limit | Checked by code after the call |
| --- | --- | --- |
| `headline` | `{en, zh}`, 1–80 each | length; no markup; no digits that are not in the lesson's own text |
| `essence` | `{en, zh}`, 1–200 each | same; for `predict`, the leak guard against final metric values and the transfer answer |
| `question` | `{en, zh}`, 1–120 each | same |

A rejection names the field and the limit (the reader rejects, never trims, like
`readShow`). The reply is returned to the browser, not stored; the creator sees it in the
editor, may change it, and saving stores what the editor holds with `textModel` set to the
model that proposed it and `textSource: "model"`; a later manual edit sets
`textSource: "edited"`. `reasoning-effort.mjs` gains `card-text: "minimal"`.

### Optional: Muse Image draws for it

**Request** `POST /api/studio/card-art`, signed in, own session:
`{sessionId, id, cardId, direction?}` for a saved lesson the caller may edit (owner or
administrator). The prompt is built server-side as the slide prompt is
(`illustrationPrompt` in `src/lesson-show.mjs`): `ILLUSTRATION_STYLE` + *Scene:* the card's
English headline and essence + *Setting:* the show's cover prompt when there is one, else
the lesson intro + the occasion look's setting phrase ("lanterns and a winter evening")
+ the optional note. Same 1000-character clip, same no-text no-numbers style, one request
on the budget, one drawing per card at a time (a redraw replaces and deletes the previous
blob).

Storage follows the record owner, not the caller: the server uploads under
`images/<hash(record.owner)>/…` so that a later save passes `store.owns(url, record.owner)`
and the administrator can draw for a creator's lesson. This is a deliberate difference from
`drawCover`, which refuses administrators; the reason the cover route refuses is that it
stores under the caller's prefix. The card route never stores under the caller's prefix.

### The chart panel

The chart is the lesson's own experiment drawn by the existing engines
(`public/function-plot.mjs`, `public/motion-graph.mjs`, `frontend/components/ExperimentView.tsx`)
into the card's SVG at the panel slot, with the reviewed default settings for that chapter.
It is code, costs nothing, and is the most honest picture a card can carry. For the
Predict card the engine's `preview` mode draws the axes and the learner's prompt without
the curve.

## 4. Storage and routes

### Record

Cards live **inside the saved lesson record** (`cards: Card[]`, default `[]` in
`buildSavedLesson`, `src/lessons.mjs`), not in a separate key, so they follow the lesson
through the compare-and-set save, the owner and shared indexes, the delete cascade and the
Blob cleanup without a second set of invariants. A card is small (under 2 KB of JSON plus a
URL), so six cards do not threaten the 3 MB save body.

```json
{
  "id": "c7f1…(16 hex)",
  "preset": { "look": "mid-autumn", "set": "predict-test-explain", "format": "landscape" },
  "role": "explain",
  "chapter": 0,
  "text": {
    "headline": { "en": "…", "zh": "…" },
    "essence": { "en": "…", "zh": "…" },
    "question": { "en": "…", "zh": "…" }
  },
  "textSource": "code" | "model" | "edited",
  "textModel": null | "muse-spark-1.3",
  "panel": { "kind": "chart" | "cover" | "illustration" | "drawn" | "none", "slideIndex": null, "url": null, "model": null },
  "png": null | "https://….public.blob.vercel-storage.com/images/<owner>/<id>.png",
  "editedBy": "owner" | "admin",
  "createdAt": 0,
  "updatedAt": 0
}
```

- `validateCard` in `src/lessons.mjs` checks the preset ids against `public/card-presets.mjs`,
  the text bounds and character ban, `panel.url` under the owner prefix, and `chapter`
  within the lesson. `validateCards` caps the array at 6 and rejects duplicate ids.
- `recordImageUrls` (`src/blob.mjs`) adds every `panel.url` of kind `drawn` and every `png`,
  so deleting a lesson deletes card art and `scripts/prune-blobs.mjs` keeps it.
- `lessonSummary` gains `cards: number` (a count) for the shelf and the library tile;
  `publicLesson` includes the array. `owner` is never returned, as today.
- A full `POST /api/lessons` update that omits `cards` keeps the stored cards; one that
  sends `cards` replaces them under the same validation (so an exported-then-imported
  lesson carries its cards). Cards in a save are refused when the lesson they describe
  changed in the same request and a card's `chapter` no longer exists.

### Routes

| Route | Who | Purpose |
| --- | --- | --- |
| `POST /api/lessons/cards` | owner or administrator (`editable()`) | `{id, cards: Card[]}` replaces the lesson's cards after validation; CAS on the record read first, 409 on conflict or over cap; removes blobs no longer referenced. Admin writes keep `owner`, `shared`, `createdAt` and `reviewedAt`, and stamp each changed card `editedBy: "admin"`. |
| `POST /api/lessons/cards/delete` | owner or administrator | `{id, cardId}` removes one card and its blobs. |
| `POST /api/lessons/cards/png` | owner or administrator | `{id, cardId, image}` stores a browser-rendered PNG (data URL, signature-checked, ≤ 1.5 MB) under the record owner's prefix as the card's `png`, so a visitor's download is the creator's render, not their own machine's fonts. Optional; without it the visitor renders locally. |
| `POST /api/studio/card-text` | signed in, own session | §3; one model request; nothing stored. |
| `POST /api/studio/card-art` | owner or administrator, own session | §3; one image request; stores under the record owner and writes the card's `panel`. |
| `GET /api/shared/:id` | public | unchanged route; the body now carries `cards`. |
| `GET /api/lessons/:id` | owner or administrator | unchanged; carries `cards`. |

All three mutation routes use `requireOrigin` and `parseBody`, and sit behind the sign-in
gate like `/api/lessons/*`. Body limits: `cards` 64 KB, `png` 3 MB (shares the lessons
limit), the studio routes 48 KB. The memory adapter (`src/state.mjs`) and the Redis adapter
(`src/redis-state.mjs`) need no new operations: the routes read, modify and `putLesson` with
the snapshot they read, exactly as a lesson update does.

### Why a card edit does not clear `reviewedAt`

The review mark covers the lesson's definition and assumptions. A card is a derived
display of that content, and a card edit cannot change what the lesson computes. The mark
therefore survives card edits by the owner. An administrator's card edit is recorded on the
card (`editedBy: "admin"`) and shown on it ("card edited by ExplainBack"), which is more
useful to a reader than silently clearing a mark about something else.

## 5. Where cards appear and who can do what

| Place | Visitor (signed out or reader) | Owner | Administrator |
| --- | --- | --- | --- |
| Shared lesson page, **Cards** strip under the show or player | see, open full size, download PNG, print, copy card link | plus **Make cards**, **Edit**, **Delete** | same as owner, labelled **Administrator actions** |
| `#card:<lessonId>/<cardId>` | the card full size with **Open the lesson**; 404 when the lesson is private | same | same |
| Creator shelf (`Library.tsx`) | — | card count on each entry, **Cards** opens the editor | same for every record |
| Library tile (`Gallery.tsx`) | a small "3 cards" chip next to the show chip | — | — |
| Gallery (reviewed) lesson page | **Preview a card** (phase 0): render and download, nothing saved | same | same |
| Create page, review bar | — | **Cards** next to Save and Export, enabled once the lesson is saved | — |

Sharing stays a lesson-level switch: a card is public exactly when its lesson is shared.
There is no per-card share flag, and the `#card:` route reads through `GET /api/shared/:id`.

### The editor

`frontend/components/CardStudio.tsx`, opened from the shelf or the lesson page, in a dialog:

1. **Pick**: Look row, Set row, Format row, with a live preview of the first card. Picking a
   set fills the cards by code at once.
2. **Edit**: a list of the set's cards; for the selected card, three text fields per
   language with counters, the panel picker (chart / cover / a slide illustration / draw
   with Muse Image / none), **Let Muse word it** (one request), and the preview.
3. **Save**: one `POST /api/lessons/cards` with the whole list; a conflict shows the saved
   version and offers to reapply.

Keyboard order follows the list; the preview is `role="img"` with `aria-label` built from
the card text; a text transcript of every card sits under the strip for screen readers.

### Export

- **Download PNG**: the SVG is serialised, images referenced by URL are first inlined as
  data URLs through `toDataUrl` (`frontend/lib/image.ts`) so the canvas is not tainted,
  then drawn on a canvas at the format's pixel size and saved with `toBlob`. Fonts are the
  system stack, so a card rendered on a phone and on a Mac differ slightly; the optional
  stored `png` (§4) makes the creator's render the one visitors get.
- **Print**: the card page has a print stylesheet that sets the page size to A6 for the
  `print` format and hides everything but the SVG; `public/themes.css` already forces a
  light palette in print.
- **Copy link / share sheet**: the `#card:` link, with the same `navigator.share` path the
  lesson uses.

### Content Security Policy

The SVG uses presentation attributes (`fill`, `font-size`, `font-family`), never `style=`,
because `style-src 'self'` has no `'unsafe-inline'`. Motifs are inline `<symbol>`s from
`public/card-motifs/`, images come from `self`, `data:` or the Blob host, which `img-src`
already allows. Nothing new is needed in `vercel.json` for phases 0–2.

## 6. Open Graph previews (phase 3, optional)

Chat apps and feeds cannot show a per-lesson image today because routes are hash fragments
and the only `og:image` is the static `brand/share.png`. A card is the natural preview. It
needs two things that are deliberately left to a last phase:

1. A path route, `/s/<id>`, rewritten to the API function in `vercel.json`, that returns a
   small HTML page with `og:title`, `og:description` and `og:image` for a shared lesson,
   then redirects a browser to `/#shared:<id>`. The lesson's first `landscape` card, or the
   static brand image when there is none, is the preview.
2. A PNG for `og:image`, because previews do not accept SVG. Either the stored creator
   render from `POST /api/lessons/cards/png`, served from Blob (no new dependency, but only
   cards the creator exported get previews), or a server rasteriser such as
   `@resvg/resvg-js` with bundled Latin and CJK fonts (a sizeable native dependency and
   about 10 MB of fonts in the function). Start with the stored render; measure before
   adding the rasteriser.

`scripts/brand-assets.mjs` already renders brand rasters with Playwright at build time, so
the seven gallery lessons can get static preview PNGs the same way without any runtime cost.

## 7. Honesty, safety and limits

- **Provenance line** (not editable, always printed): "Lesson by an invited creator ·
  not reviewed by ExplainBack" for creator lessons, "Reviewed lesson" for gallery ones;
  then, as applicable, "words by Muse Spark, edited by the creator", "picture by Muse
  Image", "card edited by ExplainBack". The library's full note stays one tap away on the
  lesson page, and **Report this lesson** covers its cards.
- **Numbers**: only code draws them (§1). A creator can type a number into card text; it
  is then the creator's statement, as the lesson's own text is.
- **Text hygiene**: the same character ban as `direction`, no markup, bounded lengths,
  bilingual required (an empty language falls back to the other with a dotted underline
  in the editor, never on the exported card).
- **Budget**: code fill, save, share, list, delete and export cost no model request.
  Muse wording and Muse Image art cost one hourly unit and one session attempt each; the
  session cap of eight attempts bounds a card session the same as any other.
- **Caps**: 6 cards per lesson; one drawn image per card; PNG ≤ 1.5 MB; `cards` body 64 KB.
- **Deletion**: deleting a card deletes its drawn art and stored PNG; deleting a lesson
  deletes everything through `recordImageUrls`; `prune-blobs.mjs` keeps referenced URLs.
- **Public content**: cards on shared lessons are public creator content, exactly as
  shared lessons are. The administrator can delete any card; a reader can report the
  lesson. Occasion motifs are neutral seasonal art; no religious or national symbols are
  in the first set, and adding a look is a reviewed source change.
- **Appearance**: the three app themes × light/dark are only the page around the card;
  the card itself is its look, so a screenshot taken in dark mode still exports the look
  the creator chose.

## 8. Tests

- **Unit (node)**: `validateCard`/`validateCards` bounds, cap, duplicate ids, prefix check;
  `fillCards` for model, process and catalog lessons and every set; the `predict` leak
  guard; preset contrast ratios for every look; `recordImageUrls` includes card URLs.
- **HTTP (node)**: the permission matrix for the three mutation routes (visitor 401,
  other creator 404, owner 200, admin 200 with `editedBy: "admin"` and untouched `owner`,
  `shared`, `reviewedAt`); spoofed `admin`/`owner` body flags ignored; CAS conflict 409;
  blob removal on delete and on replace; `card-art` stores under the record owner when the
  caller is the admin; `card-text` rejects an over-long reply and a `predict` reply that
  names the result; budget and attempt accounting.
- **Client (vitest)**: `Postcard` renders each look × format from a fixture card with the
  expected text and `aria-label`; `CardStudio` fills on preset change and sends one save;
  export inlines images before rasterising (canvas mocked).
- **E2E (Playwright)**: visitor opens a shared lesson, sees the strip, opens a card page,
  downloads a PNG; creator makes a set, edits a headline, saves, reloads; admin deletes a
  card from another creator's lesson; axe on the card page and the editor; phone width.

## 9. Phase plan

| Phase | Lands | Files | Server change |
| --- | --- | --- | --- |
| 0 — Preview | presets, `Postcard` SVG renderer, `fillCards`, PNG export, **Preview a card** on gallery and saved lesson pages, nothing saved | `public/card-presets.mjs`, `public/card-motifs/`, `frontend/lib/postcards.ts`, `frontend/components/Postcard.tsx`, `frontend/lib/export-png.ts`, hooks in `Studio.tsx` and `Gallery.tsx`, `messages.ts` | none |
| 1 — Keep | `cards` on the record, the three `/api/lessons/cards*` routes, shelf and lesson-page strip, `#card:` route, admin rights, docs | `src/lessons.mjs`, `src/card-routes.mjs` (new, mounted next to `lesson-routes.mjs`), `src/blob.mjs`, `frontend/components/CardStudio.tsx`, `Library.tsx`, `App.tsx`, `docs/lesson-library.md`, `docs/architecture.md` | additive |
| 2 — Muse | `card-text` and `card-art` studio actions, occasion phrases in prompts, the `predict-test-explain` and `chapters` sets with chart panels | `src/server.mjs` (two actions), `src/studio-cards.mjs` (new), `src/reasoning-effort.mjs`, `CardStudio.tsx` | two actions |
| 3 — Preview links | `/s/<id>` page, stored PNG as `og:image`, gallery static previews at build | `vercel.json`, `src/static.mjs`, `scripts/brand-assets.mjs` | one path route |

Phase 0 is demonstrable on its own and touches no file another agent is changing. Phase 1
is where the record and routes change, so it should start after the open pagination fix
(`codex/library-pagination-race`, PR 87) merges, and it keeps its routes in a new file to
avoid overlapping edits in `src/lesson-routes.mjs`.

## 10. Alignment notes for Codex

These are the points where this design touches areas Codex has been working in, and the
decisions it should either confirm or push back on before phase 1 starts:

1. **Record shape.** `cards: []` becomes a field of the saved lesson record with a default
   in `buildSavedLesson`, preserved on updates that omit it. Confirm this does not collide
   with the separate lesson/show model labels or any pending record change.
2. **Admin semantics.** Admin card writes keep `owner`, `shared`, `createdAt` and
   `reviewedAt`, and mark the card `editedBy: "admin"`. This differs from a lesson edit,
   which clears `reviewedAt`; §4 gives the reason. Confirm against the tester-admin rules.
3. **Art under the record owner.** `card-art` stores images under the record owner's prefix
   even when the administrator draws them, unlike `drawCover`. Confirm this is acceptable
   for `store.owns` and for `prune-blobs.mjs`, and whether `drawCover` should move to the
   same rule.
4. **`lessonSummary` gains `cards`** (a count). This is in the shared-list payload that the
   pagination work shapes; the field is additive and nullable-free (`0` when none).
5. **Route placement.** New routes live in `src/card-routes.mjs`, mounted after the sign-in
   gate; `GET /api/shared/:id` and `GET /api/lessons/:id` carry `cards` through
   `publicLesson` without route changes.
6. **Tests.** Phase 1 adds `test/cards-http.test.mjs` and `test/admin-cards.test.mjs` beside
   the existing admin tests rather than editing `test/lessons-http.test.mjs`, which PR 87
   touches.

Questions this document does not settle and leaves to Doran: the user-facing name (Cards /
Postcards), which occasion looks ship first, and whether the stored creator PNG (§4) is
worth its Blob space before phase 3 needs it.
