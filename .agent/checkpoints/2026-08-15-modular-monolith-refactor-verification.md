# Modular Monolith Refactor Verification

Date: 2026-08-15
Branch: `refactor/modular-monolith-structure`
PR: #37 (draft/unmerged until explicit user authorization)

## Completion status

Tasks 1–8 from `.agent/plans/2026-08-14-modular-monolith-refactor.md` are implemented. The four follow-up findings from `.agent/plans/2026-08-15-post-refactor-audit-cleanup.md` have also been closed with RED -> GREEN verification.

### Original modular-monolith refactor

- Access/config ownership is separated and guarded by architecture tests.
- HTTP middleware uses one canonical namespace.
- WhatsApp lifecycle/event/credential responsibilities are split into focused files under `backend/src/modules/whatsapp`.
- Messages/outbound policy, webhooks, activity, and recipients have canonical module ownership and architecture guards.
- Frontend endpoint contracts live in feature APIs; the root god API was removed.
- Dashboard uses one snapshot polling lifecycle rather than a separate readiness interval.
- Dead compatibility files and obsolete no-op persistence flush functions were targeted for removal after architecture coverage proved them dead.
- Generated `docs/.astro/` metadata is ignored and no longer tracked.

### Post-refactor audit cleanup

1. **Access and WhatsApp route ownership**
   - `app.routes.ts` moved to `backend/src/modules/access/routes.ts`.
   - `whatsapp.routes.ts` moved to `backend/src/modules/whatsapp/routes.ts`.
   - `backend/src/routes` no longer exists.
   - Access and WhatsApp architecture guards explicitly reject reintroduction of the legacy route paths.

2. **Readiness response contract**
   - The shared JSON client rejects non-JSON responses even when a non-2xx status such as 503 is explicitly allowed.
   - `getReadiness()` validates the minimal runtime readiness shape before exposing it as `GatewayReadinessSnapshot`.
   - Regression coverage includes non-JSON 503 and malformed JSON 503 responses.

3. **Non-blocking readiness refresh**
   - Readiness remains part of the existing dashboard refresh lifecycle but no longer blocks app/session/WhatsApp snapshot work.
   - Only one readiness request may be in flight at a time.
   - A generation guard prevents an older readiness completion from restoring stale state after a later backend-health failure.
   - No second polling interval or state library was introduced.

4. **Messages/WhatsApp dependency direction**
   - The dependency guard found two production reverse dependencies: `message.service.ts -> whatsapp/index` and `outbound-policy.ts -> whatsapp/account-health`.
   - `message.service.ts` is now a dependency-only factory with Messages-owned structural send/status contracts.
   - `routes.ts` exposes `createMessageRouter(messageService)` rather than importing a concrete singleton.
   - `app.ts` is the composition root that wires WhatsApp send/status functions into the Messages service/router.
   - Outbound policy receives an `accountHealthCheck` callback; WhatsApp owns Baileys account-health behavior and supplies that callback from the sender.
   - The enforced production direction is now `WhatsApp -> Messages`; production `Messages -> WhatsApp` imports are forbidden by `module-dependency-boundary.test.ts`.

### Final repository hygiene cleanup

- Access-specific integration coverage is colocated with the Access module:
  - `backend/src/api-key-rotation.test.ts` -> `backend/src/modules/access/api-key-rotation.test.ts`
  - `backend/src/app.browser-session.test.ts` -> `backend/src/modules/access/browser-session.test.ts`
- `backend/src/architecture/cleanup-boundary.test.ts` rejects reintroduction of those misplaced root tests.
- Temporary cleanup workflows are removed after use; only normal project workflows remain tracked.

## Main reconciliation — 2026-08-22

Current `main` advanced by three commits after the original refactor baseline. The refactor branch is being reconciled semantically rather than by reviving pre-refactor ownership paths.

Integration rules:

- keep `config` pure and move setup-code lifecycle into `modules/access`;
- keep Access routes under `modules/access/routes.ts`;
- keep frontend HTTP contracts in feature APIs rather than restoring `frontend/src/api.ts`;
- remove obsolete SQLite flush plumbing in the modular Messages/Activity/Recipients paths;
- preserve migration history and append migration 8 only;
- adopt the current root `AGENTS.md` fast-verified-delivery policy;
- require fresh exact-head CI/Docs/CodeQL/container verification after reconciliation.

The first reconciliation merge commit intentionally includes focused setup-code regressions before the semantic production port. Any failing RED head is execution evidence only and is not merge-ready.

## Package-manager decision

Package-local pnpm workspace and lockfiles are intentionally retained. The production `Dockerfile` installs frontend and backend dependencies in isolated stages and explicitly copies each package's `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` before `pnpm install --frozen-lockfile`. Removing those files would reduce standalone/Docker reproducibility without a compensating simplification.

## Verification history

The completed four-item audit cleanup was verified on runtime-code head `a290e67d66005cb269312cc7af3bbeebc94ea28c`:

- CI run #710: success
  - formatting/lint: success
  - full backend tests including architecture guards: success
  - full frontend tests: success
  - backend/frontend core builds: success
  - documentation build: success
  - native ARM64 Docker build: success
  - container persistence and rollback smoke: success
- Docs CI run #234: success
- CodeQL run #711: success

The subsequent documentation checkpoint head `d738dd3114f8b4c781576e61ffa2d0d9894b51d0` was also freshly verified:

- CI run #711: success
- Docs CI run #235: success
- CodeQL run #712: success
- all current inline review threads were resolved after review.

The final repository-hygiene test move was executed with an explicit RED -> GREEN helper gate. The RED guard proved both misplaced root tests; after `git mv` and import-only updates, full `pnpm check`, full backend/frontend tests, and full build passed before commit `b2b9fedcbbcbc7d15ac524fe697652aa53092dac` was pushed. The temporary helper workflow was then removed.

Any later branch-head change must receive fresh normal CI/Docs/CodeQL verification before merge consideration.

The branch must remain unmerged until the user explicitly authorizes merge.
