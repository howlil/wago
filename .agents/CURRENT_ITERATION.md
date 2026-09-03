# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Docs Standalone Static Deployment Compatibility.

Goal: make `apps/docs` build successfully when a static hosting platform uses `apps/docs` as the build root and runs pnpm in CI mode without access to the monorepo root `pnpm-lock.yaml`, while preserving the root monorepo lockfile as the canonical dependency lock for normal repository development and CI.

## Acceptance boundary

- `apps/docs` can run `pnpm install` under `CI=true` without a local lockfile;
- normal root workspace installs continue using the root `pnpm-lock.yaml` with `--frozen-lockfile`;
- no duplicate `apps/docs/pnpm-lock.yaml` is introduced;
- Docs CI reproduces the external static-builder shape by copying only `apps/docs` into a temporary directory, installing under `CI=true`, and building there;
- existing docs helper tests and root-workspace Astro build remain green;
- backend, dashboard, docs content/design, and public API behavior are unchanged.

## Active slice

Deployment compatibility implementation and verification.

## Evidence

- external deployment uses base directory `apps/docs` and `node:22-alpine`;
- deployment failed before build with `[ERR_PNPM_NO_LOCKFILE] Cannot install with frozen-lockfile because pnpm-lock.yaml is absent`;
- the repository lockfile is intentionally at monorepo root and contains the `apps/docs` importer;
- execution branch: `fix/docs-standalone-static-build`;
- baseline `main`: `dd0cfde58c540f83c314c9fced505605e18a2bf3`.

## Blockers

None known.

## Next action

Add directory-local pnpm compatibility config, add an isolated static-build smoke to Docs CI, fix any deterministic regressions, merge automatically after required gates are green, then return this file on `main` to idle.

## Completion rule

When the milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
