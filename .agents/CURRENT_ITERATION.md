# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Zero-env setup cleanup.

Goal: make Wago operator/deployment setup truly zero-env by removing user-facing environment configuration paths while retaining only internal runtime/test environment state such as `NODE_ENV` and Vitest worker identifiers.

## Current baseline

- workspace layout is `apps/gateway`, `apps/dashboard`, and `apps/docs`;
- pnpm uses one root workspace and lockfile;
- root `Taskfile.yml` is the canonical developer command surface;
- gateway remains a single-instance Express/TypeScript + SQLite + Baileys application;
- dashboard remains the Control / Settings / Audit Log operator control plane;
- first-run admin setup, WhatsApp pairing, machine API-key generation/rotation, recipient policy, and webhook configuration are already available from the dashboard;
- current `main` still exposes legacy deployment configuration through `API_KEY`, `TRUST_PROXY`, `DEFAULT_COUNTRY_CODE`, `VITE_API_BASE_URL`, Compose env forwarding, and `apps/dashboard/.env.example`;
- API-key runtime state still models an environment-owned credential even though the intended product contract is dashboard/persisted-state ownership.

## Active slice

Milestone: Zero-env setup cleanup
Goal: remove all user/deployment environment configuration surfaces.
Current slice: runtime + dashboard + deployment + docs cleanup.
Acceptance boundary:
- stock `docker compose up -d` has no user-configurable `environment:` block;
- machine API keys are generated/rotated only through Wago and persisted as hashes; no `API_KEY` deployment override or `env` API-key source remains;
- dashboard API calls are same-origin with Vite proxy used only for local development; no dashboard `.env.example` or `VITE_API_BASE_URL` path remains;
- local-number normalization uses Wago's internal `62` default rather than `DEFAULT_COUNTRY_CODE`;
- Wago does not trust proxy forwarding headers through an operator env toggle; safe direct socket identity remains the default;
- docs/security/product contracts describe zero-env as the only supported setup/configuration model;
- internal `NODE_ENV`, `VITEST_*`, and test-log controls are not treated as product/deployment configuration;
- CI, core tests/build, Docker persistence/rollback smoke, Docs CI, and CodeQL pass.
Evidence: branch `chore/zero-env-setup` created from `main` at `e5adf943b650d88a77d345d0a57ee81fbba0a2fd`.
Blockers: none known.
Next action: remove legacy env paths and align tests/docs/contracts.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state, advance to the next already-authorized slice, and remove stale blockers/next actions.

When the milestone completes, mark its gate complete and return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
