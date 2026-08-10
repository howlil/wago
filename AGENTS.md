# AGENTS.md

## Project State

Wago is a production-grade, single-instance modular monolith for one self-hosted WhatsApp account per instance.

The runtime is intentionally small: Express + TypeScript, Baileys, SQLite, filesystem-backed Baileys authentication, React, and one Docker container. Preserve that shape unless a demonstrated requirement makes it insufficient.

## Engineering Priorities

Use this order when tradeoffs conflict:

1. Correctness
2. Security
3. Data integrity
4. Reliability
5. Maintainability
6. Observability
7. Simplicity
8. Performance
9. Extensibility

Do not optimize for hypothetical scale or introduce infrastructure to imitate a larger platform.

## Architecture Boundaries

Keep module ownership explicit.

- HTTP routes own transport concerns: authentication middleware, request-shape validation, rate limiting, HTTP responses, and transport-specific activity reporting.
- Application services own use-case orchestration when a real boundary is useful.
- Business policy owns decisions and invariants, not HTTP status codes.
- Persistence modules own SQLite statements, migrations, transactions, and durable-state semantics.
- The WhatsApp module owns all Baileys-specific socket, lifecycle, connection, sender, and protocol adaptation behavior.
- Routes and unrelated modules must not manipulate or expose the raw Baileys socket.
- `index.ts` wires the application, lifecycle, HTTP server, and operating-system signals. It must not become a business-logic module.

Prefer narrow public APIs. Add an interface or layer only when it creates a concrete ownership boundary, test seam, or replacement point.

## Mandatory Backend Rules

Every backend change MUST follow these rules:

- Validate external input at the boundary before it reaches business logic.
- Represent expected application failures with stable typed error codes.
- Keep HTTP status mapping at the HTTP boundary.
- Add a regression test before fixing a behavior defect when the failure can be reproduced deterministically.
- Keep multi-write durable invariants inside explicit SQLite transaction boundaries.
- Released database migrations are append-only. Never rewrite migration versions already shipped.
- Make lifecycle and state transitions explicit, especially socket generation, reconnect, rebind, shutdown, and account-health invalidation.
- Use idempotency when retries can duplicate side effects.
- Use structured sanitized logging. Never log API keys, cookies, authorization headers, QR payloads, Baileys credentials, message text, full phone numbers/JIDs, or arbitrary raw protocol payloads.
- Startup and shutdown must be deterministic and graceful. Stop accepting new HTTP work before closing runtime/persistence state.
- Deliberate public API contract changes must be documented and covered by characterization/regression tests.
- Baileys internals must remain contained inside the WhatsApp module.

## Persistence and State

Durable application state lives under `/app/data`.

- SQLite database: `/app/data/wago.db`
- SQLite WAL/SHM files may exist while WAL mode is active.
- Baileys authentication: `/app/data/auth/`

Treat the entire directory and its backups as secret-bearing state.

SQLite is the durable application store. Keep released migrations append-only and preserve backward compatibility when possible. Use the shared transaction helper for multi-write invariants. Never move SQL into HTTP routes.

Transient socket, QR, reconnect, account-health cache, recent-message cache, and message-status cache state may remain in memory when durability is not required for correctness, safety, or diagnosis.

Never run multiple Wago replicas against the same SQLite/auth volume.

## WhatsApp and Baileys

Wago uses Baileys, an unofficial WhatsApp Web client. Do not claim guaranteed ban prevention or unrestricted deliverability.

Maintain one active WhatsApp account and one active socket lifecycle per process. Recoverable disconnects may reconnect with bounded backoff. Terminal session invalidation must stop reconnect attempts and require pairing again.

Keep low-level observability structured and sanitized. Persist normalized audit facts, not raw Baileys packet/frame objects. QR values, credentials, message content, full identifiers, tokens, and arbitrary protocol payloads must never enter the audit database.

Outbound safety controls are defensive controls, not anti-detection mechanisms. Do not implement fake typing, fingerprint spoofing, proxy rotation, bulk/campaign behavior, or restriction bypasses.

## HTTP and Errors

Keep public responses stable unless a change is explicitly reviewed.

Expected failures should flow as typed application errors into the shared HTTP error mapper. Unknown failures must be logged with sanitized context and returned as a generic 500 response without stack traces, causes, credentials, request bodies, or secret headers.

Asynchronous Express handlers should use the shared async-handler boundary rather than relying on unhandled promise behavior. Avoid catch/rethrow blocks that add no value.

## Testing and Change Discipline

For behavior changes:

1. Characterize the existing contract when needed.
2. Add the intended failing regression first.
3. Confirm the RED failure is caused by the missing behavior, not formatting or tooling.
4. Implement the smallest coherent change.
5. Run focused tests.
6. Run repository check, full backend/frontend tests/builds, Docker build, and CodeQL before merge when the scope warrants it.

Do not weaken or delete a valid regression merely to make CI green.

Use real SQLite behavior in persistence tests where practical. For Baileys, test Wago adapters, classifiers, and lifecycle/state transitions rather than depending on external WhatsApp connectivity in unit tests.

## Anti-Over-Engineering Rules

Do not add these by default:

- microservices
- Redis or queues as decoration
- background-worker infrastructure without a demonstrated workload
- generic repository/service/controller layers for every feature
- ports/adapters/factories/mappers/DTO layers without a concrete need
- dependency-injection frameworks without a concrete need
- Kafka, RabbitMQ, BullMQ, Kubernetes, service mesh, CQRS, or event-sourcing infrastructure
- SQL inside routes
- HTTP status decisions inside business policy

A small explicit module is preferable to a generic internal framework.

## Frontend

The frontend is React + Vite + TypeScript. Keep the feature-first structure and shared application shell already established. Prefer local state and focused hooks. Do not add Redux, Zustand, TanStack Query, or another router/state dependency unless current complexity demonstrates the need.

The UI must render backend uncertainty truthfully. Disconnected, unavailable, checking, and invalid-session states must never be presented as healthy/normal.

## Documentation and Planning

- `docs/` is public product documentation.
- `.agent/specs/` contains approved internal designs.
- `.agent/plans/` contains detailed implementation plans and execution evidence.
- Root `plan.md` is the concise engineering roadmap.

Do not put internal agent workflow notes under public `docs/`.

## Verification Commands

Typical repository gates:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm run build:docs
docker build .
```

Use the repository container smoke script when present for release/hardening verification.

## Security and Operational Constraints

- Never commit `/app/data`, SQLite WAL/SHM files, Baileys auth state, credentials, API keys, or live QR material.
- Keep production deployments behind HTTPS when exposed outside localhost.
- Do not use `docker compose down -v` during a normal upgrade unless durable gateway state is intentionally being destroyed.
- Back up `/app/data` before risky operational changes and treat that backup as sensitive credential material.
- Preserve rollback compatibility when changing durable state; if a migration prevents a known-good revision from opening a copied persistent volume, stop and redesign before merge.
