# ADR-0008 — Separate IAM session reference from authentication proof

- **Work:** [#49 — Prevent IAM session bearer credential exposure](https://github.com/Oxelio/Architecture-Web/issues/49)
- **Status:** accepted
- **Content status:** Canonical approved target; not current implementation
- **Document type:** Architecture Decision Record
- **Domain:** IAM authentication and sessions; Messaging and Audit integration
- **Decision authority:** Human Architecture Web maintainer; [explicit acceptance record](https://github.com/Oxelio/Architecture-Web/issues/49#issuecomment-6256348807), 19 October 2026
- **Evidence baseline:** `development` @ `a3d09eafe7caafe6542c6832a67cc6f26f219de1`
**Detailed implementation target:** [Proposed Technical Design](../iam-session-credential-separation.md)

## Context

The existing session UUID is both the credential accepted from the `sid` cookie and the resource identifier used by session-management contracts. The same value is propagated to administrator listings, `SessionStarted` event envelopes, retained Audit metadata and account data exports. `SF-SESSION-001`, `SF-SECURITY-AUDIT-001` and `SF-ACCOUNT-DATA-001` prohibit exposing the authentication secret through these channels. The finding is established independently of any decision to retain or extract `SecurityService`.

IAM owns the session aggregate, identity, access checks and application contracts. Infrastructure owns cryptographic representation and Redis persistence. ADR-0004 establishes the session aggregate and atomic maximum-session enforcement; ADR-0005 establishes versioned events and the limited guarantees of Redis → PostgreSQL outbox delivery.

## Problem

A legitimate reader of a session-management ID or an integration record can currently obtain the bearer credential. Filtering IDs from individual projections would preserve the underlying semantic hazard and leave future uses vulnerable.

## Decision drivers and constraints

- A session reference exposed by an authorized management operation **must not authenticate**.
- Session ownership, own/admin listing, current-session indication, targeted revocation, expiry, maximum-session enforcement and user-session-version invalidation remain available.
- Domain and application code must not import Redis, hashing providers or HTTP cookie APIs.
- Sensitive authentication material must not enter generic events, audit trails, exports or logs.
- New session validation must fail closed when the proof or stored record is missing, malformed or invalid.
- Avoid a second Redis lookup/index unless it provides a concrete benefit.
- A proposal cannot silently authorize legacy-session invalidation, physical historical-data rewriting, or user-visible error behavior changes.

## Options considered

### A — Retain the UUID bearer and redact secondary projections

**Advantages:** minimal new persistence and contract machinery; useful for immediate containment.

**Disadvantages:** identity still grants access; every new management/event/export path must be treated as a credential path. This does not satisfy the long-term confidentiality invariant.

### B — Independent public reference and opaque authentication token

**Advantages:** unambiguous separation and flexible token representation; token alone is an opaque random value.

**Disadvantages:** requires a safe token-to-reference lookup or additional coordinated Redis key/index; complicates atomic revocation and expiration compared with a single record.

### C — Public reference plus independent random secret (chosen)

An authentication credential consists of a version, public session reference and independently generated random secret. Only a verifier bound to the reference is retained in the authentication-only Redis session record.

**Advantages:** single Redis session record, existing management reference/revocation model, direct expiration/index semantics; leaked reference has no authentication authority.

**Disadvantages:** incompatible with UUID-only legacy cookies, changes application/port contracts, requires coordinated issuers/resolvers and additional proof verification per authentication. A leaked **complete cookie** remains a bearer credential.

## Decision — accepted structural target

Choose **Option C**, establishing these durable structural rules:

1. A **session reference** is a non-secret, authorization-protected identity for consultation, correlation and revocation. Its disclosure alone never authenticates.
2. A **session credential** is sensitive proof issued to the client; it contains independent CSPRNG-derived secret material and is verified before producing authenticated application context. It is never a public management or event value.
3. Only a protected verifier, not a raw secret or full credential, is stored with the Redis session state. Its representation and cryptographic algorithm are infrastructure details. Application ports express issuance, authentication lookup and safe management reads explicitly.
4. Authentication/session creation through password or MFA must use the same security semantics. A sign-out operation must never revoke a session based solely on an unverified public reference.
5. Integration events and audit/export projections use positive safe-field contracts; they never serialize an authentication credential, raw secret or verifier. Version affected integration contracts explicitly.
6. Old UUID bearer credentials must **not** remain valid through a fallback resolver. The authorization and execution of a coordinated cutover are separate operational/functional decisions.

**Proposed technical realization, not an ADR invariant:** `sid=v2.<R>.<S>`, where `R` is a UUIDv7 reference and `S` is 32 uniformly random bytes in canonical base64url; bind an SHA-256 verifier to protocol version, reference and secret with an unambiguous domain-separated encoding. Keep Redis single-record, absolute TTL, and atomic non-resurrecting session-touch semantics. See the Technical Design for specifics. Alternative implementations preserving these six durable rules may be considered in the design review.

## Consequences

**Positive:** public session management and correlatable events no longer leak authentication authority; credential parsing and verification are explicit and testable; the existing aggregate and package boundaries are preserved.

**Trade-offs:** port and cookie compatibility changes, increased cryptographic work at resolution, cross-package DTO/event changes, and operational migration obligations. A stolen complete cookie still works until revocation/expiry. Unrelated pending-deletion and stale-write risks are **not** solved by this decision.

## Target and synchronization

- **Approved target:** bounded correction of IAM session credential handling in Work #49; not a broad IAM redesign.
- **Current Truth:** the current resolver still accepts UUID bearer values. Do not edit `docs/architecture/overview.md` or guides to state the proposed design as implemented.
- **Acceptance record:** [human acceptance for Work #49](https://github.com/Oxelio/Architecture-Web/issues/49#issuecomment-6256348807). The detailed Technical Design remains Proposed; this structural approval alone does not grant implementation Readiness.
- **When effective:** synchronize the current architecture overview, dependency/package documents only if affected, and `docs/guides/iam-sessions.md` as required by the implemented result. Validate integration schema changes against ADR-0005.

## Unresolved authority and deployment dependencies

The human maintainer has separately **approved sign-out behavior** for Work #49, now owned by [SF-SESSION-001](../../specifications/SF-SESSION-001.md) and recorded in the [Functional Approval](https://github.com/Oxelio/Architecture-Web/issues/49#issuecomment-6256658492). The approval also confirms **no new user-visible export, Audit or Notifications features**. This architectural decision does **not** authorize (1) wiping any retained development/test sessions without operator evidence (there have been no deployments); (2) mutation/deletion of historical Audit records subject to retention/holds; (3) new user-facing export states or reprocessing of retained ZIPs without their owner's authority; or (4) unapproved MFA notification changes. Those remaining boundaries are tracked in the [working decision and evidence register](../../explorations/iam/work-49-decision-register.md). No Tasks, Readiness, implementation, merge or Work State transition is established here.