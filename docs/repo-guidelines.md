# What belongs in this repository

This repository is public and is what a reviewer audits. The test is simple: **a file that
explains how the project works belongs here; a file about how the project is presented,
judged or defended belongs in the separate private repository.**

## In the repository

- Application source, tests, fixtures and the scripts that build, check or operate it.
- `README.md`, `docs/architecture.md` and feature docs such as `docs/lesson-library.md`:
  what the system does, its limits, and how to run it.
- `.env.example` with variable names and guidance, never values.
- Synthetic test data and the reviewed gallery content, with their provenance stated.
- A short, neutral provenance statement (in the README): what existed before the event,
  what was built during it, and asset origins.

## Private repository (`~/app/explainback-private`, never committed here)

- Demo scripts, video shot lists, rehearsal notes and talking points.
- Provenance deliberations: timeline evidence, modification-time analysis, organizer
  correspondence or links, open eligibility questions, source inventories.
- Readiness reviews and operational numbers: quotas, concurrency slots, lockout thresholds,
  which code a judging group uses, access-code labels.
- Work logs, progress ledgers and implementation plans once their work has landed.
- Reviewed, redacted evaluation reports. Raw output and media remain local unless separately
  selected for private archival; `output/` is ignored in this public repository.

The private repository is a separate Git repository with its own remote and ignore rules;
it is not a second remote for this application's history. Check that its GitHub visibility
is private before publishing internal material. Application code, tests, synthetic fixtures
and generic operating instructions remain here. Implementation constants remain auditable
in source and tests; account-specific settings, rehearsal counts and measured timings go
in the private notes.

## Local only (never committed to either repository)

- Credentials, access-code values, tokens, passwords and live invite or private share links.
  Keep credentials in a password manager or deployment environment. Ignore local access
  records even inside the private checkout. Rotate any credential that was ever committed.
- Environment files, browser profiles, cookies, storage state, raw traces and unredacted logs.
- Video/audio/image production media, Final Cut libraries and generated exports. Keep these
  alongside the private notes locally; a media inventory can record paths, sizes and hashes.
  Text edit timelines and production scripts may be committed after review.

## Before pushing

1. `git status` shows only source, tests, docs and config you intend to publish.
2. No new public note names a judge group, a real code label, an account quota or a
   Discord/organizer link.
3. `npm run scan:secrets` passes. Review the complete staged diff too: the scanner detects
   known patterns, not every possible credential or sensitive record. `.env.example`
   contains only empty secret values and clearly synthetic examples.
4. Docs updated in the same change (`docs/architecture.md` when system shape changes).

Git history keeps what was once committed. Removing a file later limits exposure but does
not erase it; treat anything that was ever pushed as public.
