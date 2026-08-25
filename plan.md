# Wago Engineering Direction

## Product shape

Keep Wago intentionally small:

- one process
- one WhatsApp account per instance
- one SQLite database
- Baileys auth under `/app/data/auth`
- one React dashboard
- one Docker image
- no bulk/campaign, anti-detection, multi-tenant, or distributed-system machinery

## Current objective: Production Confidence

Architecture normalization is complete enough. Do not start another broad refactor phase without evidence of a concrete recurring problem.

Priorities, in order:

1. **Reliability evidence** — restart, reconnect, persistence, backup/restore, degraded upstream, webhook retry, and upgrade behavior.
2. **Small operational signals** — readiness correctness, reconnect duration, outbound result classification, webhook delivery health, storage health.
3. **Fast delivery** — keep focused tests fast, CI deterministic, WIP small, and PRs easy to review/revert.
4. **Remove compatibility debt** — prefer one current contract; compatibility code must have a real supported upgrade need and a removal release.
5. **Repository hygiene** — one workspace lockfile, low Dependabot noise, no dead dependencies or generated repository clutter.

## Engineering rule

```text
need -> smallest testable slice -> ship -> observe -> improve from evidence
```

Do not create milestones merely to reorganize code. New abstractions, infrastructure, or architecture changes must be justified by measured friction, production failure, or a concrete requirement.

Completed work is tracked by Git history and pull requests, not duplicated in this file or a permanent `.agent` archive.
