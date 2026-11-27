# ADR-0012 — OAuth Authorization Server Integration and Grant Authority

**Status:** Accepted
**Content status:** Canonical
**Document type:** Architecture Decision Record
**Domain:** IAM / Delegated Authorization

## Context

[Work #215](https://github.com/Oxelio/architecture-web/issues/215) owns
delegated authorization, including OAuth integration. [Work #214](https://github.com/Oxelio/architecture-web/issues/214)
consumes delegated authorization for MCP, including resource exposure and
client-specific interoperability. The [approved Functional Specification](../../specifications/SF-DELEGATED-AUTHORIZATION-001.md)
owns the grant lifecycle and effective authorization behavior, including
partial consent, permission withdrawal, permanent invalidation and final
operation admission. [PR #216](https://github.com/Oxelio/architecture-web/pull/216)
carries the proposal and experimental evidence.

## Problem

OAuth authorization codes, access tokens and refresh tokens need an issuer
that handles protocol state and interoperability. A provider grant or
browser session can also retain consent or scopes. Treating those records as
business authorization would split authority and could allow stale approval,
credential renewal or scope revival after IAM changes.

## Decision drivers and constraints

- IAM owns client admission, account eligibility, consent, permission policy
  and grant lifecycles. Adapters call IAM through public application contracts.
  OAuth library types belong to infrastructure.
- Consent finalization, credential issuance, revocation and final operation
  admission need a defined ordering against current IAM state. A failed
  commit must withhold credentials. Unavailable authority fails closed.
- Withdrawing one permission must prevent its reuse after regrant. Preserving
  unaffected permissions avoids unnecessary reconnection.
- Work #215 needs an interoperable, maintainable protocol implementation.
  Use the [Technical Design and feasibility results](../../technical-designs/TD-DELEGATED-AUTHORIZATION-001.md#executable-feasibility-evidence)
  to evaluate the exercised OAuth profile and the unverified production paths.

## Options considered

| Option                                                                                        | Advantages                                                                                                              | Trade-offs                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embed `oidc-provider` behind an IAM protocol adapter                                          | Maintained OAuth implementation, custom interactions and storage, and a direct path to a shared PostgreSQL transaction. | The Fastify bridge and transaction semantics need verification. Provider storage and hook behavior are version-sensitive. The API process hosts the authorization issuer.                            |
| Deploy an independent authorization server with external login and consent, such as Ory Hydra | Independent operations and a separate process boundary.                                                                 | IAM ownership still requires synchronous authorization and durable credential lifecycle coordination across stores. The candidate's actual resource-indicator support and edition need verification. |
| Adopt a separate identity platform, such as Keycloak                                          | Integrated identity and authorization-server capabilities.                                                              | Reusing it while retaining current IAM account, authentication and grant authority requires a demonstrated boundary. Adopting its identity lifecycle would broaden this Work substantially.          |
| Own the full OAuth implementation                                                             | Complete control over protocol state and transaction ordering.                                                          | The project takes on protocol correctness, interoperability, security fixes and conformance maintenance.                                                                                             |
| Invalidate an entire affected credential family when a permission is withdrawn                | Simpler invalidation and lookup. Can contain replay to a single family.                                                 | In the spike, withdrawal also removed unaffected read from mixed-scope families and required fresh consent to reconnect.                                                                             |

## Decision

Use an embedded `oidc-provider` OAuth adapter, with version `9.15.1` as
the evaluated baseline. IAM remains the unique business authorization
authority. Provider Grants and credentials are subordinate records bound to one
IAM grant lifecycle and resource. The resource adapter calls IAM for effective
authorization at final operation admission.

Use immutable permission-level generations in credential lineage. Serialize
authoritative issuance with invalidation and atomically consume the incoming
credential and persist its successors before releasing a successful response.
Use the [Technical Design](../../technical-designs/TD-DELEGATED-AUTHORIZATION-001.md)
for the Fastify boundary, explicit redirect guard and remaining implementation
constraints.

The embedded option demonstrated partial consent, no scope revival, atomic
consumption, replay containment and both issuance/revocation orderings using
public extension points and one primary database. Permission-level generations
preserved read continuity after write withdrawal and regrant. An independently
deployed provider remains viable if it demonstrates equivalent authority and
transaction guarantees.

## Consequences

### Benefits

- IAM remains the source of effective authorization across first-party and
  delegated flows. Provider credential expiry, replay cleanup and IAM
  business grant revocation have distinct lifecycles.
- OAuth-specific validation and serialization stay at the transport and
  infrastructure boundaries. A provider change can preserve IAM's application
  contracts if the replacement meets the same consistency guarantees.

### Costs and open constraints

- Provider upgrades require executable compatibility tests for hooks, payload
  mapping, redirect validation and commit/error behavior. The deployed OAuth
  host needs a supported Node LTS build.
- The Fastify bridge must prove commit-before-response, including technical
  failure, handled replay and connection loss. Production lock ordering,
  fan-out and recovery need verification against existing IAM transactions.
- Stable grant and permission identities, authoritative admission and
  account-linked erasure add schema and lifecycle responsibilities. The exposed
  endpoint profile and client interoperability still need review.

## Structural acceptance

The Architecture Web maintainer explicitly accepted the decision on 2026-11-26
at [candidate fca0d8f92a12f5c87e50dfcff8a8404705d3e514](https://github.com/Oxelio/architecture-web/blob/fca0d8f92a12f5c87e50dfcff8a8404705d3e514/docs/architecture/decisions/0012-oauth-authorization-server-integration-and-grant-authority.md),
PR #216. See the [attributable decision](https://github.com/Oxelio/architecture-web/issues/215#issuecomment-7202625547).
This is an accepted target, not effective current architecture, Readiness or
merge authority. The Technical Design owns remaining integration decisions.

## Target and synchronization

The [approved Functional Specification](../../specifications/SF-DELEGATED-AUTHORIZATION-001.md)
remains the behavioral target. The
[proposed Technical Design](../../technical-designs/TD-DELEGATED-AUTHORIZATION-001.md)
owns technical contracts and evidence for Work #215. ADR-0012 records the
accepted structural rationale.

When the accepted target is effective, synchronize these current-state owners:

| Owner                                                                                                                | Scope                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Architecture overview](../overview.md)                                                                              | IAM capability, OAuth boundary, API composition and transaction responsibilities.                  |
| [Packages and public APIs](../packages.md) and [dependency rules](../dependency-rules.md)                            | Actual adapter placement, public application contracts and the inward dependency direction.        |
| [IAM security](../iam-security.md)                                                                                   | Issuance and admission order, effective invalidation, session independence and credential erasure. |
| [Cross-context compliance](../cross-context-compliance.md) and [IAM event reliability](../iam-events-reliability.md) | Effective audit and notification facts, delivery and account erasure interactions.                 |

The accepted decision preserves the aggregate and PostgreSQL consistency rationale in
[ADR-0004](0004-aggregates-and-consistency.md), event ownership in
[ADR-0005](0005-domain-events-messaging.md), and IAM-owned erasure evidence in
[ADR-0010](0010-iam-erasure-evidence.md). Runtime pinning and deployment-image
verification remain Work #215 technical preparation.
