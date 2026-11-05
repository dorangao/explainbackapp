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
- Start Claude Code from the repository root so it loads `.claude/settings.json`.
  Shared permissions pre-approve check commands and common Git queries;
  formatting writes and Git mutations are not pre-approved. Single-file
  tests use `node --test` or `npx --no-install` so npx cannot download a missing runner.
  Personal permission overrides belong in `.claude/settings.local.json`, which is ignored;
  `.claude/worktrees/` is ignored too.
- Keep paid-script deny rules explicit and in sync with `package.json`, including their
  direct Node entry points. Claude's trailing `:*` syntax means a command prefix, so
  `Bash(npm run eval:*)` does not block `npm run eval:live`. Use exact script names followed
  by ` *` to cover the command and its arguments.
- File deny rules anchor at the session's primary working directory (`Read(/.env.local)`),
  which is the repository root when started there; later `cd` commands do not move that
  anchor. `.env.example` remains readable. These are permission guardrails, not
  an OS sandbox: arbitrary subprocesses can read files indirectly, so do not use a script
  or another tool to work around a denied read or paid command. See the
  [Claude Code permission documentation](https://code.claude.com/docs/en/permissions).
