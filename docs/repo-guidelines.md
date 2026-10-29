# What belongs in this repository

This repository is public and is what a reviewer audits. The test is simple: **a file that
explains how the project works belongs here; a file about how the project is presented,
judged or defended stays local.**

## In the repository

- Application source, tests, fixtures and the scripts that build, check or operate it.
- `README.md`, `docs/architecture.md` and feature docs such as `docs/lesson-library.md`:
  what the system does, its limits, and how to run it.
- `.env.example` with variable names and guidance, never values.
- Synthetic test data and the reviewed gallery content, with their provenance stated.
- A short, neutral provenance statement (in the README): what existed before the event,
  what was built during it, and asset origins.

## Local only (kept in `~/app/explainback-private`, never committed)

- Demo scripts, video shot lists, rehearsal notes and talking points.
- Provenance deliberations: timeline evidence, modification-time analysis, organizer
  correspondence or links, open eligibility questions, source inventories.
- Readiness reviews and operational numbers: quotas, concurrency slots, lockout thresholds,
  which code a judging group uses, access-code labels.
- Work logs, progress ledgers and implementation plans once their work has landed.
- Raw evaluation output, traces, screenshots and recordings (`output/` is ignored).
- Anything containing a credential, invite code, token or live share link. Rotate any that
  was ever committed.

## Before pushing

1. `git status` shows only source, tests, docs and config you intend to publish.
2. No new file names a judge group, a code label, a quota or a Discord/organizer link.
3. `grep -rn "EXPLAINBACK_ACCESS_CODES=\|BLOB_READ_WRITE_TOKEN=\|MODEL_API_KEY=" --exclude-dir=node_modules .`
   returns only `.env.example` lines with empty values.
4. Docs updated in the same change (`docs/architecture.md` when system shape changes).

Git history keeps what was once committed. Removing a file later limits exposure but does
not erase it; treat anything that was ever pushed as public.
