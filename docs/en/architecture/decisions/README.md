# Architectural decisions

This register records only decisions demonstrated by current code. Future
decisions **SHOULD** use `NNNN-short-title.md` and include context, options,
decision, consequences, and status.

Aggregates and their consistency boundaries are detailed in
[ADR-0004](0004-aggregates-and-consistency.md).
Domain Events, the outbox, and exchanges with Audit and Notifications are
detailed in [ADR-0005](0005-domain-events-messaging.md).
The separation between accounts, login identities, and authenticators is
detailed in
[ADR-0006](0006-iam-account-identities-and-authenticators.md).

## ADR-0001 — Technology-independent IAM core

**Status: accepted**

IAM rules must remain stable when PostgreSQL, Redis, hashing, or email
providers change. Use cases therefore depend on abstract application ports.
Infrastructure packages implement them, and the API selects adapters.

The core is testable in isolation and alternatives can coexist. A port change
must, however, update all adapters and test doubles.

## ADR-0002 — Specialized pnpm monorepo packages

**Status: de facto accepted**

The `apps/*` and `packages/**` workspace separates private applications,
IAM core, Foundation, ESLint tooling, and each infrastructure technology.
Boundaries are visible in manifests and exports, at the cost of more packages
and cross-package validation. No independent publication policy is established.

## ADR-0003 — Manual composition in the API

**Status: accepted**

`apps/api/src/composition-root` creates PostgreSQL and Redis, instantiates
adapters, calls `createIam`, and exposes `dispose`. This keeps the startup
graph explicit and framework-free. Replacing a technology changes the
composition point, which is the intended extension seam.

## Open decisions

- whether packages are published outside the monorepo;
- shared or independent versioning;
- automated enforcement of all dependency rules;
- correction of the historical `persitence` path;
- keeping `SecurityService` in the API or extracting dedicated use cases and
  adapters;
- the scheduling strategy for security maintenance.

These topics must not be presented as decided before an explicit code change or
new ADR.
