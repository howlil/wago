# Contributing

## Scope

Wago is a single-account, self-hosted WhatsApp gateway. Keep changes aligned with that scope. Do not add multi-tenant, campaign, bulk sender, Redis, database, Kubernetes, or anti-detection features unless the project scope explicitly changes.

## Local Setup

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

Run app-specific commands when working in one area:

```bash
pnpm --dir backend test
pnpm --dir frontend test
```

## TDD Expectations

When using TDD here, drive behavior with unit tests. Write or update the relevant unit test first, verify the failure when practical, implement the smallest change, then rerun the targeted test.

Do not unit-test Baileys internals. Test Wago wrappers, policy decisions, validation, response mapping, caches, stores, and lifecycle behavior.

## Pull Requests

Pull requests should include:

- a concise description of the behavior change
- tests or a clear reason tests are not applicable
- local verification commands run
- screenshots for frontend UI changes
- linked issues when relevant

Never attach auth directories, QR payloads, API keys, full phone numbers, full JIDs, message text, or raw production logs.
