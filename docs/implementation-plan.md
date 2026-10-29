# Standalone submission runtime plan

Goal: deliver a complete local ExplainBack repository with a standard HTTP layer and replacement formula/plot helpers. The user authorized these replacements on October 28 Pacific.

## Design

Keep the existing event-era learning and lesson services, React UI, public gallery, review gates and scoped hosted authentication. Replace custom HTTP dispatch/body streaming with Express 5 routes, bounded JSON middleware and centralized safe errors. Keep workflow actions and shared state behind the new routing and middleware layer. Replace the two timestamp-disputed graph/math helpers with a bounded formula registry and D3 scales/path rendering. Do not claim that rewriting code proves its earlier eligibility. Source chronology remains explicit in PROVENANCE.md.

## Work

- [x] Export tracked source/config/tests/assets from pinned `acb0ed3` into the independent local repository. Exclude old source archives, credentials, local output and pre-event setup probes.
- [x] Add failing behavioral tests for compressed JSON rejection and formula/plot safety and independent SVG clipping.
- [x] Build Express request middleware, explicit routes and error handling, keeping business workflow state/locks, quota, revocation and redaction contracts.
- [x] Implement the formula registry through the existing bounded arithmetic interpreter and a D3 plot module; move all consumers off the two earlier helper files.
- [x] Verify existing engine/HTTP tests, React tests, typecheck, lint/format, production build and browser journeys. Check Vercel-style already-parsed request paths and the hosted open-access override locally. An actual hosted deployment remains unverified.
- [x] Record exclusions, author clarification, replacements, third-party library attribution and actual validation. Keep publication, deployment and submission separate. Source inventory is in `SOURCE-MANIFEST.json`.

Review focus: byte limits for native and parsed requests; foreign/absent Origin on mutating requests; sign-out/reset during pending paid requests; explicit provider selection; SVG clipping IDs and invalid numerical inputs; source/credential exclusion.

**Meta transport:** implemented with the OpenAI-compatible SDK against Meta’s endpoint, retries disabled. Synthetic transport tests and one live low-token text request passed; this is not an end-to-end lesson test.
