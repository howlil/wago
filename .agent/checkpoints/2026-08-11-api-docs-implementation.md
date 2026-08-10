# API Documentation Refresh Checkpoint

Status: implementation complete and verified; pending PR review/merge.

Current branch: `docs/api-docs-refresh`

Pull request: `#21` — `docs: refresh README and interactive API documentation`

Implemented:

- public README rewritten around server-to-server integration;
- public Astro Overview, Getting Started, API, Architecture, Configuration, Operations, and bilingual landing pages resynced with current runtime behavior;
- typed catalog for all 15 current public HTTP routes;
- Hybrid API Explorer with endpoint-aware fields, cURL/JavaScript/Python/Node.js generation, direct browser execution, response status/latency/content-type rendering, and confirmation for every POST;
- real API key stays in React component memory and is not rendered into generated snippets;
- stronger confirmation for `/whatsapp/rebind`;
- structured audit filters/cursor and 2,000-event retention documented;
- SQLite persistence references corrected, including the bootstrap/pairing PlantUML diagram;
- old fixed `CodePlayground` removed and all public landing/API surfaces now use the Hybrid API Explorer;
- documentation helper contract tests and Docs CI test step added;
- latest `main` Iteration 19 audit workspace merged into this branch before final verification.

TDD evidence:

- RED commit: `3a2f2e707fccc7343f60c6a0418e2a17500278d5`
- RED Docs CI: run `31421737961` failed at `Test documentation helpers` because the catalog/helpers did not exist yet; install and Biome were green.
- GREEN head: `888b033c79ec6b3630e103ed86b1f313c189c5d2`

Fresh verification on GREEN head:

- Docs CI run `31423719573`: success
  - dependency install: success
  - `pnpm check`: success
  - `pnpm --dir docs test`: 11 tests passed, 0 failed
  - `pnpm build:docs`: success
- Core CI run `31423719828`: success
  - formatting/lint: success
  - backend/frontend tests: success
  - core build: success
  - production Docker build: success
- CodeQL run `31423719864`: success
- PR mergeability after syncing latest `main`: `mergeable=true`, `behind_by=0`.

Review notes:

- endpoint-catalog regression asserts each current public route appears exactly once;
- generated snippets use `YOUR_API_KEY`; the entered secret is only attached to the live request Authorization header;
- GET requests do not receive JSON bodies;
- path parameters are URL-encoded and blank query parameters are omitted;
- all POST live actions require explicit confirmation and rebind gets a stronger warning;
- public docs do not claim inbound messages, webhooks, media, groups, delivered/read/played receipts, multi-session, or ban-prevention guarantees;
- `docs/` contains public documentation only; agent specs/plans/checkpoints live under `.agent/`.
