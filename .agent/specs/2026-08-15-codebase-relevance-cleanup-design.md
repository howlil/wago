# Codebase Relevance Cleanup Design

## Goal

Remove obsolete runtime wrappers and stale compatibility residue from Wago without deleting upgrade paths that are still required, while keeping production persistence fail-closed and aligning deployment behavior with the platform contract.

## Scope

This cleanup is intentionally conservative around durable state and external contracts.

### Remove

- Runtime persistence flush wrappers that are no-ops because SQLite writes commit synchronously on the shared connection.
- Dead persistence aggregator modules with no runtime consumer.
- Test-only compatibility helpers that merely proxy no-op persistence state when the underlying store is already SQLite-backed.
- Stale documentation or roadmap wording that contradicts the current SQLite/session/webhook/persistence behavior.

### Preserve

- Legacy JSON-to-SQLite import because it remains an upgrade path for older installations.
- Legacy webhook environment import because it remains a one-time migration path when SQLite settings are empty.
- Legacy browser API-key cookie cleanup because existing browsers may still carry the old cookie.
- `/health` as liveness and `/ready` as operational readiness; they are separate contracts rather than duplicates.
- Production `/app/data` mount validation and single-instance ownership.

## Persistence Contract

Do not weaken `PERSISTENT_DATA_REQUIRED` by making a bare Docker anonymous volume count as a sufficient deployment guarantee. The Wago image must continue to fail when the orchestrator does not deliberately attach stable storage.

The preferred platform integration is explicit deployment metadata that lets MyPaaS provision a deterministic named volume while keeping generic `docker run` without a mount fail-closed. If the platform only understands Docker `Config.Volumes`, update the platform contract rather than silently weakening Wago's guard.

## Runtime Cleanup

Application shutdown should only perform work that has real durability semantics. SQLite-backed activity, recipient, and outbound-policy stores do not require asynchronous flush calls. Shutdown should stop workers and WhatsApp, release the lease, checkpoint SQLite, and close the database.

## Frontend

Keep the current distinction between basic backend reachability and operational readiness. Only remove code proven to have no distinct consumer or behavior.

## Testing

- Update lifecycle regression tests first to express the intended shutdown sequence without fake persistence flush steps.
- Keep storage/mount regressions unchanged so generic production containers without an explicit mount still fail.
- Run backend, frontend, docs, Docker smoke, and CI gates before merge.

## Git Discipline

Use one cleanup branch and one PR. Keep historical `.agent` artifacts intact unless their current-state wording is misleading; they are engineering history, not runtime dead code.
