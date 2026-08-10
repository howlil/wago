# API Documentation Refresh Checkpoint

Status: implementation pushed for verification.

Current branch: `docs/api-docs-refresh`

Implemented:

- public README rewritten around server-to-server integration;
- public Astro Overview, Getting Started, API, Architecture, Configuration, and Operations pages resynced with current runtime behavior;
- typed catalog for all 15 current public HTTP routes;
- Hybrid API Explorer with endpoint-aware fields, cURL/JavaScript/Python/Node.js generation, direct browser execution, response status/latency/content-type rendering, and confirmation for every POST;
- real API key stays in React component memory and is not rendered into generated snippets;
- stronger confirmation for `/whatsapp/rebind`;
- structured audit filters/cursor and 2,000-event retention documented;
- SQLite persistence references corrected, including the bootstrap/pairing PlantUML diagram;
- old fixed `CodePlayground` removed;
- documentation helper contract tests and Docs CI test step added;
- latest `main` Iteration 19 audit workspace merged into this branch before verification.

Verification target:

```bash
pnpm check
pnpm --dir docs test
pnpm build:docs
pnpm test
pnpm build
```

Do not mark this checkpoint complete until fresh branch CI/Docs CI/CodeQL results are green.
