# GHCR Release Queue Hotfix Plan

**Status:** root cause identified; not part of the public documentation refresh.

## Problem

Release Container run `31377431025` / run #42 remained `in_progress` from commit `75f6531909c16960a806b6285eb9f9fcf8525224` while its `Publish Core GHCR Image` job was stuck at `Build and push core image`.

The release workflow uses a per-ref concurrency group with `cancel-in-progress: false`. Newer `main` runs therefore wait behind the stale active run, and GitHub may replace/cancel older pending runs while the stale active run still holds the concurrency slot.

## Proposed Hotfix

- [ ] Cancel the stale run once from GitHub Actions to release the current lock.
- [ ] Change release workflow concurrency to `cancel-in-progress: true` because only the newest `main/latest` publish matters.
- [ ] Add a bounded `timeout-minutes` to the publish job so a hung image build cannot hold the release queue indefinitely.
- [ ] Push a reviewed workflow-only change.
- [ ] Verify the next `main` release publishes `ghcr.io/howlil/wago-simple:latest`.
- [ ] Confirm the multi-architecture image still exposes `linux/amd64` and `linux/arm64` as intended.

## Boundary

Do not mix this workflow hotfix into API documentation or outbound-safety runtime changes. Keep it independently reviewable and revertible.
