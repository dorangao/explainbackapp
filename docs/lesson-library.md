# Saved lessons, sharing and the catalog

Added October 28, 2026 Pacific. A signed-in creator (a reviewer invite or the tester account) can keep the lessons it made, share any of them by link, and the public library gains search, filters and a section of creator-shared lessons. None of these actions makes a model request.

## Saving

- **Save to my lessons** sits next to Export in the review bar. It stores the checked lesson and, when the draft has a current narrated show, the show script (narration and cover prompt, never the cover image bytes). The model that drafted the lesson is recorded as a label.
- Saving again from the same draft updates the same copy (**Save changes**); the remembered draft in this browser keeps the saved copy's id so a reload still updates rather than duplicates.
- **Your lessons** on the Create page lists the shelf newest first with Open, Share and Delete (two-step). Opening loads the lesson into the review view with its show, the test learner's report and any explain-back grades (added October 29, 2026), all without a model request. Grades keep the client cache key they were made with, so each shows as fresh or stale against the live lesson state exactly as before.
- Each creator keeps up to 50 lessons. Ownership is the invite label (`code:<label>`) or `tester` for the password account, so the same invite sees its lessons from any browser; everyone using one invite shares one shelf.

## Sharing

- The **Private / Shared by link** switch on a saved lesson turns a public link on or off: `https://explainback.app/#shared:<id>`. Ids are 16 random hex characters.
- A shared lesson opens for anyone without signing in, straight into the player, with its show when one was saved, and a provenance note saying it was shared by its creator from Lesson Studio rather than reviewed by the library's author.
- Copy link, the system share sheet where the browser offers one (phones, Safari), and the existing Export JSON remain the ways to pass a lesson on. Turning the switch off hides the lesson immediately; the saved copy is unchanged.
- Shared lessons also appear in the library under **Shared by creators**, newest first, up to 48, and take part in search and filters.

## Catalog

- A search box matches titles and summaries in both languages, so a Chinese reader finds an English-titled shared lesson and vice versa.
- Filter chips: All, Adjustable models, Process explorers, Experiment series, From a sketch, With a show. The count updates live and an empty result says so.

## Server

| Route | Who | Purpose |
|---|---|---|
| `GET /api/lessons` | signed in | List the creator's shelf (summaries) and the cap. |
| `GET /api/lessons/:id` | owner | Full saved lesson with its show script. |
| `POST /api/lessons` | owner | Save (`{lesson, show?, model?}`) or update (`{id, …}`). Validated by the lesson schema and a show-script check. |
| `POST /api/lessons/share` | owner | `{id, shared}` toggles the public link. |
| `POST /api/lessons/delete` | owner | `{id}` removes the lesson and its link. |
| `GET /api/shared` | public | Newest shared lessons (summaries). |
| `GET /api/shared/:id` | public | One shared lesson with its show script; 404 when private or missing. |

Storage: `src/lessons.mjs` builds and validates records; `src/state.mjs` (local memory) and `src/redis-state.mjs` (Upstash) keep one JSON record per lesson with a per-owner index and a shared index, no TTL. Mutations in Redis run as single scripts so ownership checks and index updates cannot drift.

## Limits and honesty

- Saved and shared lessons are creator content. They have not been through the library author's content review; the provenance note and the catalog section say so.
- Without Blob storage, covers and illustrations are not stored, so a shared show plays without them; see *Images and Blob storage* below.
- Local development keeps the shelf in process memory; restarting the server clears it. Hosted environments keep it in Redis.

## Images and Blob storage (added October 29, 2026 Pacific)

Image bytes live in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) when `BLOB_READ_WRITE_TOKEN` is set; Redis keeps only URLs. Without the token the app behaves as before: images reach the browser as data URLs for the session and are dropped when a lesson is saved, and the save notice says so.

- **What is stored.** The show cover drawn by Muse Image, slide illustrations drawn on request, and the sketch a lesson was created from. Blobs are public by URL; every path is `images/<owner hash>/<random>.<format>`, so a URL is unguessable and a save request may only reference images under its own owner prefix. A data URL in a save request is decoded and checked by its real container signature (WebP, PNG or JPEG, at most 1.5 MB) before upload.
- **When.** A cover or illustration is uploaded as soon as it is drawn, so the browser holds a short URL rather than bytes and the remembered draft stays small. A sketch is uploaded when the lesson is saved. Replacing an image deletes the previous blob; deleting a lesson deletes all of its blobs; a save refused by the cap removes what it uploaded.
- **Illustrations.** The show writer marks up to two claim, transfer or takeaway slides where a picture of the real-world situation would help (`illustrate: true`, prompt version `show-v2`); the show request draws the cover and then those slides, one at a time, while the request budget allows, and leaves the rest for the player. The six reviewed gallery shows were regenerated this way on October 29, 2026, and the seventh (`explainback`, the hand-authored lesson about the pipeline itself) was made the same way on October 30: each has a cover and two slide illustrations under `public/gallery/`. A show may have up to three slides per chapter plus the cover and takeaway (nine for a one-chapter lesson, never more than twelve), and the reader's rejection names the slide and the limit that failed. In the show player a signed-in creator can also ask for **Illustrate this slide** (one per slide, redrawable) or **Redraw cover**, with an optional note such as "warm morning light". The server builds the prompt from the checked script (the slide's English heading and narration, the show's cover prompt as the setting, the same editorial style as covers); the browser never sends a free prompt. Each drawing is one request on the session budget. The controls are hidden for shared and gallery shows.
- **Narration voice.** The player speaks with the browser's own voices, ranked for the narration's locale (`frontend/lib/voices.ts`): an exact `zh-CN` or `en-US` voice first, voices marked Enhanced, Premium, Natural or Google and known-good names (Tingting, Samantha, Ava) ahead, regional voices after, and the platform's novelty voices (Eddy, Grandma, Whisper and the like) last. The platform's own order often puts a novelty voice first, which made the Chinese readout sound poor. A **Narration voice** picker on the show lists the ranked voices; the choice is kept per language in the browser's local storage. Installing a higher-quality system voice is enough to change the default; no model is involved.
- **Where images show.** The show player (cover slide and illustrated slides, with a credit line), the creator's shelf (cover thumbnail), the catalog's shared cards (cover art; "Created from a sketch" when a sketch was saved, and the From a sketch filter includes it), and the player's provenance note for shared lessons created from a sketch. A lesson drafted in Studio from the creator's own sketch shows a Studio provenance note under its Spotlight panel; the dated note about the library's pendulum lesson belongs to that gallery entry only.
- **Orphans.** Images drawn in a session that is never saved stay in the store. `node --env-file=.env.local scripts/prune-blobs.mjs --live` lists blobs under `images/` older than seven days, collects every URL that a saved lesson still references (by scanning the Redis lesson keys) and deletes the rest; without `--live` it only reports.
- **Content Security Policy.** `img-src` allows `https://*.public.blob.vercel-storage.com` in `src/server.mjs` and `vercel.json`.

| Route | Who | Purpose |
|---|---|---|
| `POST /api/studio/detect` | signed in, studio session | `{sessionId, image, concept}` asks SAM 3.1 for every match of one short noun phrase in the attached image and returns `{concept, boxes, width, height, model}` in image pixels (up to 32 boxes); 503 without the model, 400 for a sentence or question instead of a noun phrase. The Spotlight under a sketch lesson's provenance draws the boxes; results stay in the session. |
| `POST /api/studio/illustrate` | signed in, studio session | `{sessionId, lesson, show, slide?, direction?}` draws one slide illustration (or the cover when `slide` is omitted) and returns `{image, model, slide, prompt}`; 503 without the image model, 400 for an unknown slide or a note with markup. |
| `POST /api/lessons` | owner | Now also takes `cover`, `coverModel`, `illustrations` (`{slideIndex: url}`) and `sketch`, each a data URL to upload or a URL already stored under this creator. |
| `GET /api/status` | signed in | Adds `images` (image model available), `imageStorage` (Blob configured) and `detect` (SAM 3.1 available). |

## The judge path (added October 29, 2026 Pacific)

A signed-in creator sees **The six-minute tour** at the top of the Create page: draft the cooling-coffee lesson, try it as a learner, make the narrated show with its cover, illustrate the claim slide, save, share. **Run next** does one step; **Run all remaining** runs them in order and stops at the first failure. The illustration step draws the slide the writer flagged but the show had no time for, so a complete tour ends with both pictures. Each step is the same action as its button elsewhere on the page, so caches, the request budget and messages behave identically: a step whose result is already present (or restored from this browser) is marked done and costs nothing, and the footer states how many requests the remaining steps will make and how many this session has used. The illustration step is marked *Not on this server* when the image model is absent. The tour is a reviewer aid and a rehearsal script for the demo video; it adds no server routes.

## Display units (added October 31, 2026 Pacific)

A generated model lesson is authored and computed in its own units (the cooling lesson in °C, min and 1/min). A viewer may ask to see US customary units instead:

- **In the player.** When a lesson has a convertible unit (°C, m, cm, km, kg, g, m/s, km/h, L, N, kPa and their rates), a **Units** choice appears above the parameters: *Metric* or *US*. Choosing US converts, for display only, the parameter labels and ranges, the number fields, the plotted values, the readouts, the caption, the calculated-evidence line and the transfer question's settings. A value typed into a number field in °F is converted back and snapped to the authored step (85 °C, not 85.2) before it reaches the engine; the slider itself always runs on the authored grid. The transfer answer is typed in the displayed unit and converted back before the code checks it against the authored answer, with the same relative tolerance. The choice is remembered in this browser (`explainback.units`) and applies to every lesson opened there.
- **What does not change.** The engine, the test learner, the explain-back grade, the show script and the saved lesson all keep the authored units; the model never sees a converted number. Catalog experiments and process lessons have no toggle. Text the author wrote (framing, explanation, assumptions) is not rewritten; the cooling lesson's transfer question therefore says "Answer in the unit shown", and the author prompt asks new lessons not to name the unit inside the question.
- **For creators.** In Studio, the review panel has **Default units for viewers** (metric or US). It is stored on the lesson as an optional `units` field (`validateLesson` accepts `"metric"` or `"us"`), travels with saves and shares, and sets what a viewer sees first; viewers can still switch. Changing it stales no cached tryout, show or revision (the field is stripped from cache keys and from the draft sent to Muse) and survives a Muse revision. If the lesson text names a unit, ask Muse to reword it in the revision box.

## Evaluation showcase (added October 31, 2026 Pacific)

The library has a section **From the evaluation**: lessons the two Muse models drafted during the frozen `studio-breadth-v1` run recorded in the [evaluation card](evaluation.md), shown unedited.

- **What is shown.** Fourteen lessons from the eleven teachable questions: one reply per question (the higher-judged one, ties alternating between the models so both appear), plus the other model's reply for three questions where the judge raised issues, so the two can be read side by side. Each card names the model, shows the learner question in both languages, the judge score and issue count, and the latency; its provenance note names the suite, case, checks and judge, and says the author has not reviewed the science.
- **Compare the two models.** `/#compare:<case>` (for example `#compare:logistic-growth-en`) shows both replies to one question in two columns: title, intro, claim, inputs and outputs or stages, transfer question, then the judge's five rubric scores, the issues it raised and its summary, latency and tokens, and a link to open each lesson. The footnote repeats the card's limit: one sample each, not a ranking.
- **How it is built.** `node scripts/eval-showcase.mjs <run directory>` reads the local `report.json` files a live `eval:studio` run wrote (never committed), checks that every selected reply passed the automated checks and was judged, re-validates each lesson and writes `public/evaluation-lessons.mjs`. The selection is a fixed list in the script, so the same run always produces the same fixture. `test/evaluation-showcase.test.mjs` plays every showcase lesson to completion in both languages and checks the pairing.
- **Honesty.** These are model outputs chosen because they passed the checks, not because the author vouches for them; the note on every lesson says so, and the filter keeps them apart from the reviewed gallery. They play locally with no model request.

## Compare two models in Studio (added October 31, 2026 Pacific)

Next to **Create a lesson**, a signed-in creator sees **Compare two models** when both Muse text models are configured. It sends the typed question to Muse Wonder and Muse Spark at once, checks both replies and shows them side by side, in the same two-column view the library uses for the evaluation showcase.

- **What happens.** `POST /api/studio/compare` (`{sessionId, topic, judge?}`) drafts the question with the creator and tester roles in parallel, runs each reply through the same validator and open-question scorer the evaluation uses (contract valid, renderer kind, at most two chapters, a unit-labelled output for a model), and then has the judge score each ready lesson on the five-item rubric: the tester role (Spark) unless `judge` names the other compared model's id, which the **Rubric judge** picker beside the button offers (Muse Wonder or Muse Spark). The reply carries both drafts with status (`ready`, `unsupported`, `rejected`, `failed`), the validator's reason where it refused, the judge's scores and issues, and each model's latency and tokens.
- **Cost.** Two requests for the drafts, charged up front, plus one per ready lesson for the judge (`judge: false` skips it): two to four requests on the hourly budget and the session's eight attempts. A comparison that would exceed the session cap is refused before any call.
- **Choosing.** **Review this draft** under a ready reply carries that lesson into the normal review flow (check, try out, present, save); the other reply is dropped. **Discard comparison** clears both. The comparison is not remembered across a reload.
- **Honesty.** A declined or rejected reply is shown as such, never repaired. The judge's scores are one model's view of wording, kept apart from the checks, and whichever model judges scores its own draft as well as the other's. Neither draft has been reviewed for science until the creator does so.
