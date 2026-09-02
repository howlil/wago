# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** none.

Wago is at an idle, resumable baseline. No new product milestone is authorized by this file.

## Current baseline

- workspace layout is `apps/gateway`, `apps/dashboard`, and `apps/docs`;
- pnpm uses one root workspace and lockfile;
- root `Taskfile.yml` is the canonical developer command surface;
- gateway remains a single-instance Express/TypeScript + SQLite + Baileys application;
- dashboard remains the Control / Settings / Audit Log operator control plane;
- Wago product/deployment setup is zero-env: stock Compose has no product configuration environment block and no `.env.example` setup path;
- first-run admin ownership, WhatsApp pairing, machine API-key generation/rotation, recipient policy, and webhook configuration are owned by Wago workflows and durable state;
- machine API keys have only `generated` or `unset` state; deployment-owned API-key overrides are removed;
- dashboard API calls are same-origin, with the Vite proxy used only for local development;
- local-number normalization uses Wago's internal country-code default `62`;
- forwarded client identity is not trusted through an operator/deployment configuration toggle;
- internal process/test environment state such as `NODE_ENV`, `VITEST_*`, and opt-in test logging is not a product configuration surface;
- README, Security, public Configuration/Deployment docs, PROJECT, and DECISIONS describe zero-env as the supported product setup model;
- PR #114 was squash-merged to `main` as `651ac8b1ba6bbdc8ea5fd89ef1a3d1bdaf9a9151` after CI, Docs CI, CodeQL, core build/tests, and Docker persistence/rollback smoke passed.

## Active slice

None.

Blockers: none known.

Next action: none until the user authorizes the next milestone.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state, advance to the next already-authorized slice, and remove stale blockers/next actions.

When the milestone completes, mark its gate complete and return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
