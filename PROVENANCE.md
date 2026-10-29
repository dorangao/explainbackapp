# Source and submission provenance

This candidate is an independent Git repository prepared from ExplainBack source snapshot `acb0ed3a8de4c155d947cc9378cfc2ebae8c2e6b`. It has no inherited source-project Git history. A fresh repository does not itself prove when its contents were developed; a complete event-only provenance review is still required.

## Organizer guidance

The [organizer's FAQ](https://discord.com/channels/1557169028080869426/1557169028626251802/1564257793945632779) says that when building on an existing project, the submitted repository should be a standalone extract containing only work done during the event, with the existing codebase excluded. The demo should open by identifying what already existed and what was built during the event. A separate [organizer correction](https://discord.com/channels/1557169028080869426/1557169028626251802/1564291996036759676) says the building period officially begins after the kickoff session. The kickoff was scheduled for October 26 at 9 a.m. Pacific; its actual end time has not been verified here.

## Timeline evidence and uncertainty

Doran previously stated that only Muse API setup preceded October 26 and application development started October 26. On October 28, Doran said he believes the app files were built after kickoff, and requested replacement or removal of insignificant disputed pieces. This is the owner's recollection, not independent verification of each file or line.

The original repository's first commit, `da3ca89`, is dated October 26 at 9:46 p.m. Pacific. An earlier 18-file source baseline was captured at 5:18 p.m. Pacific that day. Its manifest records modification times before 9 a.m. for several files, including `public/graph.mjs` (8:32), `public/math.mjs` (8:54), `src/server.mjs` (8:30), and `src/meta.mjs` (8:57). At source snapshot `acb0ed3`, graph and math still matched their baseline hashes; server and model adapter had changed. Modification times can be preserved or affected by clock discrepancies and do not establish exact authorship or creation dates. Conversely, later Git commits do not prove every line was created after kickoff.

## Package boundary

The candidate was populated from tracked source, frontend, public assets, API code, configuration, synthetic fixtures and tests at the pinned snapshot. Historical baseline archives and development documentation, environment files, node_modules, locally generated output and API setup probe scripts (`scripts/meta-check.mjs`, `scripts/meta-smoke.mjs`, and `scripts/security-check.mjs`) were excluded. The original source remains the provenance reference; this extraction does not change it.

On October 28 Pacific, the HTTP transport was adapted to Express, the graph and formula helpers were replaced with D3 and a bounded expression catalog, and Meta Responses transport was updated to the OpenAI-compatible SDK against Meta’s endpoint. The old graph/math files and API setup probes are absent. The HTTP workflow logic, validation and parts of the Meta adapter—including image and speech transport—remain derived from the original application. They do not prove the rest of the application or any reused business logic originated after kickoff. Essential code including the Meta adapter has a mixed or uncertain timeline. Review all included source and dependencies before making an event-only claim.

The codebase includes third-party open-source dependencies, synthetic test material and gallery content. Project source carries its [MIT license](LICENSE); dependencies carry their own terms. Source project notes describe gallery covers as Muse Image outputs and the pendulum sketch as hand-drawn. Confirm relevant rights, asset origins, contributor eligibility, and whether an existing base or external dependencies are acceptable under the organizers' rule.

## Before a submission

- Reconcile the owner timeline with retained modification-time evidence and establish the applicable kickoff boundary.
- Review the complete candidate, including reused runtime logic, generated material, assets and dependencies, for eligibility and rights. Ask the organizers about mixed-timeline components where necessary.
- Verify the executable application, tests and clean-install setup; perform a comprehensive secret review, including any history that will be published.
- Confirm the final public repository and video are accessible, identify every contributor as required, and distinguish the live deployment from this local candidate.

No organizer eligibility decision, hosted deployment or hackathon submission is established by this document.


## Verification on October 28 Pacific

Node 22.23.1: 259 Node tests, 30 component tests, 18 browser tests, typecheck, lint (warnings), formatting and production build passed. A clean copy installed from the lockfile offline with lifecycle scripts disabled and built successfully. The serverless lock-release path is covered by a delayed-cleanup regression test. One small live Meta text request completed using the new SDK; no complete live Studio flow or Vercel deployment was tested. A limited heuristic secret scan is not a comprehensive review. These checks do not establish teaching quality or event eligibility.
