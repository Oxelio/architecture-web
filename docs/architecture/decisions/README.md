# Architecture Decision Records

Architecture Web ADRs implement the generic decision and ownership policy in
[Artifact ownership](../../../external/software-engineering-method/artifact-ownership.md) and the ADR trigger in
[Work classification](../../../external/software-engineering-method/work-classification.md).

An ADR owns the context, alternatives, rationale, and consequences of a durable
structural architecture decision. It is transversal, not a mandatory feature
stage. Routine naming, formatting, or obvious local implementation choices do
not need ADRs.

New records **SHOULD** use `NNNN-short-title.md` and the
[ADR template](../../project/templates/adr.md). An accepted target decision does
not make the target architecture effective immediately: synchronize current
architecture documentation when the decision becomes effective in the system.

## Register

Aggregates and their consistency boundaries are detailed in
[ADR-0004](0004-aggregates-and-consistency.md).
Domain Events, the outbox, and exchanges with Audit and Notifications are
detailed in [ADR-0005](0005-domain-events-messaging.md).
The separation between accounts, login identities, and authenticators is
detailed in
[ADR-0006](0006-iam-account-identities-and-authenticators.md).
The accepted package-first workspace topology is detailed in
[ADR-0007](0007-package-first-workspace-topology.md).

[ADR-0008 — Separate IAM session reference from authentication proof](0008-session-reference-and-authentication-proof.md) is the human-accepted structural target for Work #49. The session credential implementation is not yet current architecture; its [Technical Design](../iam-session-credential-separation.md) records the Approved Target for Work #49. Neither accepted document asserts implementation or Readiness.

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
- keeping `SecurityService` in the API or extracting dedicated use cases and
  adapters;
- the scheduling strategy for security maintenance.
