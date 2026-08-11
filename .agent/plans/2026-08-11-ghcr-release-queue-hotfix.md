# GHCR Release Queue Hotfix Plan

**Status:** completed and verified on `main`.

## Problem

Release Container run `31377431025` / run #42 had previously remained `in_progress` while `Build and push core image` was executing a multi-architecture build through QEMU. Later stale `main` release work demonstrated the same operational queue problem: with `cancel-in-progress: false`, newer releases could wait behind an obsolete active run.

The original release log also exposed a `pnpm --version` segmentation fault while executing the ARM64 build. Moving the release to a native ARM64 runner removed QEMU from the path, but release run #53 reproduced exit code `139` on native `linux/arm64`. That isolated a second root cause: the standalone `pnpm-linux-arm64-musl` executable used by the Dockerfile was itself unreliable in this build environment.

## Completed Hotfix

- [x] Set release concurrency to `cancel-in-progress: true` so newer work for the same ref supersedes stale active work.
- [x] Confirmed the stale release #52 was automatically cancelled when the newer `main` release acquired the same concurrency group.
- [x] Replaced one QEMU-emulated multi-platform build with parallel native builds:
  - `linux/amd64` on `ubuntu-24.04`;
  - `linux/arm64` on `ubuntu-24.04-arm`.
- [x] Added a 25-minute timeout to each platform build and a 10-minute timeout to final publication.
- [x] Push platform images by digest and assemble the final multi-architecture manifest only after both native builds succeed.
- [x] Scope GitHub Actions build cache per architecture.
- [x] Replace the standalone architecture-specific pnpm executable with repository-pinned `pnpm@11.21.0` installed through the Node/npm runtime.
- [x] Add a native ARM64 Docker build regression job to pull-request CI.
- [x] Preserve SBOM/provenance generation and final GitHub build-provenance attestation.
- [x] Verify publication of `ghcr.io/howlil/wago-simple:latest`.
- [x] Verify the published OCI image index contains both `linux/amd64` and `linux/arm64`.

## Execution Evidence

### PR #24 — release workflow repair

PR `#24`, `fix(ci): speed up and unblock GHCR multi-arch releases`, removed QEMU from the release path, introduced native per-platform builds, digest-based manifest publication, `cancel-in-progress: true`, and bounded timeouts. Its Core CI and CodeQL gates passed before squash merge to `main` as `ec4c392d67c409263e717f00a66e9ebcd1a8037c`.

Release run #53 then failed quickly on the native ARM64 runner at the standalone pnpm executable with exit code `139`. This was useful verification: the old multi-hour QEMU hang was removed, and the remaining failure was isolated to the Dockerfile's ARM64 pnpm runtime.

### PR #25 — ARM64 pnpm runtime repair

PR `#25`, `fix(docker): make pnpm runtime reliable on native arm64`, replaced the standalone pnpm binary with `pnpm@11.21.0` installed through Node/npm and added `Native ARM64 Docker Build` to CI.

Before merge, the exact PR head passed:

- repository formatting/lint;
- backend/frontend tests;
- core and documentation builds;
- amd64 Docker build plus persistence/rollback smoke;
- native ARM64 Docker build;
- CodeQL.

PR #25 was squash-merged to `main` as `b3a0145bc8b2acaff30605a7444227ecda1b2aa1`.

## Final Release Verification

Release Container run `31461762889` / run #54 completed successfully from `b3a0145bc8b2acaff30605a7444227ecda1b2aa1`.

Verified results:

- `Build linux/amd64` — success;
- `Build linux/arm64` — success;
- `Publish Multi-Arch GHCR Image` — success;
- published tags:
  - `ghcr.io/howlil/wago-simple:main`;
  - `ghcr.io/howlil/wago-simple:latest`;
  - `ghcr.io/howlil/wago-simple:sha-b3a0145`;
- published OCI index digest: `sha256:db1e01bb55aba85eec42e924318558ef929dae3fddcaec25e10f25c7dd39539b`;
- manifest inspection verified `linux/amd64` and `linux/arm64`;
- build-provenance attestation completed successfully;
- run #54 completed from `05:28:42Z` to `05:30:35Z`, approximately 1 minute 53 seconds.

## Boundary

The hotfix changes release/CI behavior and the build-time pnpm installation mechanism only. It does not change Wago public API behavior, WhatsApp runtime policy, persistence semantics, or the outbound-safety milestone.
