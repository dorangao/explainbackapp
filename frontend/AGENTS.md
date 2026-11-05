# frontend/: conventions

Applies with the root `AGENTS.md`.

- One component per file in `components/`, its Vitest + Testing Library test beside it as
  `Name.test.tsx`. Pure logic goes in `lib/` with a `.test.ts`; keep components thin.
- Strings: every visible string is a key in `lib/messages.ts` with `en` and `zh`, rendered
  through `t(language, key)`; `say(language, en, zh)` from `lib/types.ts` is for a one-off
  pair. Tests assert on the English text; add a Chinese assertion when the change is about
  wording.
- Server calls go through `lib/api.ts` (`post`, `request`, `ApiError` with `status`, `code`
  and `retryAfter`). Match on `error.code` before `error.status`; show the server's fixed
  sentence rather than inventing one. Never retry a failed model call automatically.
- Routing is by URL hash (`#lesson:<id>`, `#shared:<id>`, `#about`, `#evaluation`); state
  that must survive a reload lives in `lib/studio-store.ts` under the recovery scope, not in
  ad-hoc `localStorage` keys.
- Styles are in `styles.css`, `appearance.css`, `canvas.css` and `labs.css` with CSS custom
  properties for colour; both light and dark appearance must work. The library grid is three
  columns above 800 px, two to 540 px, one below.
- Accessibility: name every control, keep one `h1` per page, manage focus when you replace
  content (see the Judge check and the two-step delete), and keep `e2e/accessibility.spec.ts`
  green.
- Format with `npm run format`; lint with `npm run lint`. `react/exhaustive-deps` is an error.
- Component tests: `npx vitest run frontend/components/<Name>.test.tsx`. Browser flows:
  `npm run build && npx playwright test e2e/<spec>.spec.ts`.
