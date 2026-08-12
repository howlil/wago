# Product Landing and Documentation Refresh Design

## Goal

Reposition the public Astro homepage as a product landing page for developers and self-hosters, keep the Hybrid API Explorer inside API documentation, and synchronize public documentation with the current Wago runtime.

## Product positioning

Wago is a deliberately small, self-hosted, single-account WhatsApp gateway for developers who want one inspectable runtime they control. The primary audience is a developer or self-hoster integrating WhatsApp into an existing application. The operator dashboard is a secondary audience and should be presented as part of the product rather than as the product itself.

The landing page must not read like API reference documentation. Its job is to explain what Wago is, how quickly its mental model can be understood, why its safety and audit boundaries matter, and where to continue.

## Landing-page information architecture

Both `/id` and `/en` use the same structure:

1. Hero: product category, concise value proposition, primary Docs CTA, secondary GitHub/API Reference CTA, and a product UI-style visual rather than an interactive API console.
2. Three-step path: Deploy -> Pair -> Integrate.
3. Why Wago: single-account scope, self-hosted state, protected REST API, durable local state, controlled outbound behavior, and operational visibility.
4. Controlled outbound messaging: recipient permission/opt-out, idempotency, local defensive guardrails, account-health/reach-out signals, and explicit statement that these are defensive controls rather than anti-ban guarantees.
5. Small by design: one Node.js process, SQLite, persistent Baileys auth, React dashboard, one Docker container; explicitly not a campaign/multi-tenant platform.
6. Own your runtime and data: `/app/data`, local persistence, loopback compose exposure, HTTPS/reverse-proxy expectation, backup sensitivity.
7. Static API teaser: a short non-interactive integration example linking to the API reference. The Hybrid API Explorer remains only in `/docs/api`.
8. Responsible-use/disclaimer section: Baileys is unofficial, Wago is not affiliated with Meta/WhatsApp, no deliverability/ban guarantees, and bulk/restriction-bypass behavior remains outside scope.
9. Final CTA: Get Started / Documentation / GitHub.

## Documentation corrections

Public docs and README must describe the current runtime, not removed configuration.

- Remove `.env.production.example` instructions because that file is no longer present.
- Remove `CORS_ORIGIN` as a Wago environment variable. Current production origin protection compares the request `Origin` to the request `Host`, and requires HTTPS in production.
- Document `API_KEY` as the only operator-facing optional credential override. With no API key and no persisted generated credential, the dashboard can bootstrap the first credential.
- Keep production port fixed at `3000` and Compose published on `127.0.0.1:3000`.
- Preserve `/app/data/wago.db` and `/app/data/auth/` persistence guidance.
- Update API/bootstrap documentation to explain same-origin HTTPS validation rather than configured CORS origin.
- Clarify that the Hybrid API Explorer sends browser requests directly to a user-provided Wago base URL and therefore normal browser same-origin/CORS behavior depends on the operator's external routing/proxy setup; Wago itself does not expose a configurable CORS allowlist.
- Document the QR pairing recovery behavior accurately: Wago resolves the current WhatsApp Web version before creating the Baileys socket and falls back to the bundled Baileys version if version resolution fails.
- Keep public claims bounded to implemented behavior: text outbound API, recipient policy, retained pending/accepted/rejected state, account health, audit events, pairing/rebind, Docker/GHCR distribution, and dashboard controls.

## Visual direction

Keep the existing dark developer-tool identity and green accent, but make the homepage feel like a product surface rather than a documentation playground. Use lightweight Astro/Tailwind markup only; do not add a new design-system dependency or client-side framework code for the landing page.

The hero product visual should be a static HTML/CSS representation of Wago concepts (connection state, recipient policy, message status, audit/health) so the page remains fast, deterministic, and truthful without requiring screenshots or live API access.

## Scope boundaries

- No backend behavior changes.
- No API contract changes.
- No new runtime dependencies.
- No media/webhook/inbound/groups/multi-session claims.
- No anti-detection or ban-prevention claims.
- Do not remove the Hybrid API Explorer from `/docs/api`.
- Keep English and Indonesian pages structurally equivalent.

## Verification

Add a documentation regression test that fails when:

- either homepage imports or renders `ApiExplorer`,
- the product landing loses its Deploy/Pair/Integrate structure,
- README or public configuration/deployment/API documentation reintroduces `CORS_ORIGIN`, or
- README reintroduces `.env.production.example` setup instructions.

Run repository formatting/lint, docs helper tests, and Astro docs build through Docs CI.