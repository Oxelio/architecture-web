# Architecture Decision Records

ADR means **Architecture Decision Record**. An ADR preserves the context,
alternatives, rationale, and consequences of a durable structural architecture
decision.

ADRs are transversal artifacts: they are **not** a mandatory stage after every
Functional Specification or Technical Design. Create one when several
reasonable alternatives exist and future maintainers would otherwise have to
rediscover why an important architectural choice was made.

Routine naming, formatting, or obvious local implementation choices do not
need ADRs.

New records **SHOULD** use `NNNN-short-title.md` and the
[ADR template](../../project/templates/adr.md). Accepted decisions must be
reflected in the current owner documentation; the ADR owns the rationale, not a
second copy of current architecture truth.

## Register

Aggregates and their consistency boundaries are detailed in
[ADR-0004](0004-aggregates-and-consistency.md).
Domain Events, the outbox, and exchanges with Audit and Notifications are
detailed in [ADR-0005](0005-domain-events-messaging.md).
The separation between accounts, login identities, and authenticators is
detailed in
[ADR-0006](0006-iam-account-identities-and-authenticators.md).

### ADR-0001 — Technology-independent IAM core

**Status: accepted**

IAM rules must remain stable when PostgreSQL, Redis, hashing, or email
providers change. Use cases therefore depend on abstract application ports.
Infrastructure packages implement them, and the API selects adapters.

The core is testable in isolation and alternatives can coexist. A port change
must, however, update all adapters and test doubles.

### ADR-0002 — Specialized pnpm monorepo packages

**Status: de facto accepted**

The `apps/*` and `packages/**` workspace separates private applications,
IAM core, Foundation, ESLint tooling, and each infrastructure technology.
Boundaries are visible in manifests and exports, at the cost of more packages
and cross-package validation. No independent publication policy is established.

### ADR-0003 — Manual composition in the API

**Status: accepted**

`apps/api/src/composition-root` creates PostgreSQL and Redis, instantiates
adapters, calls `createIam`, and exposes `dispose`. This keeps the startup
graph explicit and framework-free. Replacing a technology changes the
composition point, which is the intended extension seam.

## Open decisions

The following topics are not established decisions merely because they are
listed here. Explore them first and create an ADR if/when an explicit structural
choice is made:

- whether packages are published outside the monorepo;
- shared or independent versioning;
- automated enforcement of all dependency rules;
- correction of the historical `persitence` path;
- keeping `SecurityService` in the API or extracting dedicated use cases and
  adapters;
- the scheduling strategy for security maintenance.
