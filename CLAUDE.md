# ExplainBack

@AGENTS.md

Notes specific to Claude Code:

- Read `frontend/AGENTS.md` or `src/AGENTS.md` before editing in those trees.
- Verify with `npm run verify` before opening a pull request; add `npm run test:browser`
  (after `npm run build`) when the change is visible in the browser.
- Never read `.env.local` or anything under `secrets/`; `.env.example` has the variable
  names. Never run the `eval:*`, `shows:gallery` or `claim:smoke` scripts as part of
  ordinary work: they spend money on the configured key.
- The checkout may be shared with other agents and people. Check `git status` and the
  current branch first, work on your own branch or in a worktree, and never switch a branch
  that someone else has checked out.
- Personal permission overrides belong in `.claude/settings.local.json`, which is ignored.
