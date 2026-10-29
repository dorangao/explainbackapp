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
- **Illustrations.** The show writer marks up to two claim, transfer or takeaway slides where a picture of the real-world situation would help (`illustrate: true`, prompt version `show-v2`); the show request draws the cover and then those slides, one at a time, while the request budget allows, and leaves the rest for the player. The six reviewed gallery shows were regenerated this way on October 29, 2026: each has a cover and two slide illustrations under `public/gallery/`. A show may have up to three slides per chapter plus the cover and takeaway (nine for a one-chapter lesson, never more than twelve), and the reader's rejection names the slide and the limit that failed. In the show player a signed-in creator can also ask for **Illustrate this slide** (one per slide, redrawable) or **Redraw cover**, with an optional note such as "warm morning light". The server builds the prompt from the checked script (the slide's English heading and narration, the show's cover prompt as the setting, the same editorial style as covers); the browser never sends a free prompt. Each drawing is one request on the session budget. The controls are hidden for shared and gallery shows.
- **Where images show.** The show player (cover slide and illustrated slides, with a credit line), the creator's shelf (cover thumbnail), the catalog's shared cards (cover art; "Created from a sketch" when a sketch was saved, and the From a sketch filter includes it), and the player's provenance note for shared lessons created from a sketch.
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
