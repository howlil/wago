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
- Dead compatibility files and obsolete no-op persistence flush functions were removed after architecture coverage proved them dead.
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

## Package-manager decision

Package-local pnpm workspace and lockfiles are intentionally retained. The production `Dockerfile` installs frontend and backend dependencies in isolated stages and explicitly copies each package's `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` before `pnpm install --frozen-lockfile`. Removing those files would reduce standalone/Docker reproducibility without a compensating simplification.

## Runtime-code verification

The completed four-item cleanup was verified on runtime-code head `a290e67d66005cb269312cc7af3bbeebc94ea28c`:

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

This checkpoint update is documentation-only. The branch head created by this checkpoint must receive the same fresh CI/Docs/CodeQL verification before the PR is considered merge-ready.

The branch must remain unmerged until the user explicitly authorizes merge.
