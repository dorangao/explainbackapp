# Saved lessons, sharing and the catalog

Added October 28, 2026 Pacific. A signed-in creator (a reviewer invite or the tester account) can keep the lessons it made, share any of them by link, and the public library gains search, filters and a section of creator-shared lessons. None of these actions makes a model request.

## Saving

- **Save to my lessons** sits next to Export in the review bar. It stores the checked lesson and, when the draft has a current narrated show, the show script (narration and cover prompt, never the cover image bytes). The model that drafted the lesson is recorded as a label.
- Saving again from the same draft updates the same copy (**Save changes**); the remembered draft in this browser keeps the saved copy's id so a reload still updates rather than duplicates.
- **Your lessons** on the Create page lists the shelf newest first with Open, Share and Delete (two-step). Opening loads the lesson into the review view with its show; it does not restore tryout reports or explain-back grades, which belong to a provider session.
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
- Covers are not stored, so a shared show plays without its illustration.
- Local development keeps the shelf in process memory; restarting the server clears it. Hosted environments keep it in Redis.
