# Technical Design — Third-Party Application Authorization

> **Identifier:** TD-DELEGATED-AUTHORIZATION-001
>
> **Artifact status:** Proposed
>
> **Content status:** Proposed Target
>
> **Document type:** Technical Design
>
> **Domain:** IAM / Delegated Authorization

## Work context

[Work #215](https://github.com/Oxelio/architecture-web/issues/215),
Product Behavior Change / Complex / security, privacy, cross-system.

Authorized functional source:
[SF-DELEGATED-AUTHORIZATION-001](../specifications/SF-DELEGATED-AUTHORIZATION-001.md).
[Human Functional Approval](https://github.com/Oxelio/architecture-web/issues/215#issuecomment-7200073282)
covers the exact functional candidate at d992b51bb6530d257212fd98b46d24640aa2be68.
This design does not change that behavior or establish current architecture.

Architecture owners:
[principles](../project/architecture-principles.md),
[overview](../architecture/overview.md),
[dependency rules](../architecture/dependency-rules.md),
[packages](../architecture/packages.md),
[IAM security](../architecture/iam-security.md),
[ADR-0004](../architecture/decisions/0004-aggregates-and-consistency.md),
[ADR-0005](../architecture/decisions/0005-domain-events-messaging.md),
[testing](../development/testing.md).

Design baseline: focused reads of current main and the Work branch, plus the
[executable feasibility evidence](#executable-feasibility-evidence).
Work #215 includes the OAuth authorization server integration. The accepted
structural rationale is in
[ADR-0012](../architecture/decisions/0012-oauth-authorization-server-integration-and-grant-authority.md).

## 1. Authorized behavior / constraints to preserve

Use the approved SF, not protocol defaults, to decide grants, permissions,
security invalidation, consent, admission boundaries, notifications and export.
Preserve existing account, MFA, session, audit and deletion owners. No delegated
administrative access. No raw browser session credential crosses the delegated
boundary. MCP adapters, tools, UI and distribution belong to #214.

## 2. Bounded-context / responsibility ownership

Add a fourth IAM application capability, delegatedAuthorization, alongside
accounts, authentication and administration. Existing administration remains
responsible for administrator eligibility; delegatedAuthorization owns the
client policy and grant lifecycle. No independent bounded context or shared
cross-context domain model is justified by current requirements.

IAM is the unique business authorization authority. It owns client admission,
permission policy, consent, grant lifecycles and final delegated admission.
The OAuth protocol adapter owns codes, tokens, interactions and provider Grant
references. Each provider Grant is bound to one IAM grant lifecycle and resource.
The presence of provider state alone cannot authorize an operation.

Notifications and Audit consume integration facts under existing ADR-0005.
The composition root wires public contracts and concrete adapters.

## 3. Domain responsibilities and consistency boundaries

Separate aggregate roots:

- ClientApplication: stable application identity, enabled state, revision and
  allowed/required permissions per protected resource.
- AuthorizationGrant: stable, non-reused lifecycle identity, account/client/
  resource references, granted permissions, active/revoked state and timestamps.
  Grant operations enforce explicit extension, restriction and termination.

Use typed identifiers and permission values where they prevent meaningful
invariant violations. A protected resource is an explicit platform-owned
identifier mapped by the protocol adapter to its canonical resource URI.
Do not introduce a Resource aggregate or generic permission-rule engine.
The product permission catalog is owned by the relevant product capabilities;
IAM enforces recognized capability identifiers, not foreign domain models.

Do not append unbounded client/grant collections to UserEntity. Reuse
authoritative account state and transactional fences for cross-aggregate
invariants. Consent requests and credentials are protocol/application state,
not automatically new domain aggregates.

One active grant per user/client/resource is a persistence-backed invariant.
A new grant after revocation has a different lifecycle identity. Permission
withdrawal and restoration must also prevent old credential scope revival.

### Initial resource catalog boundary

A platform-defined resource descriptor and its permission definitions are
registered through trusted application composition, not by OAuth client
metadata or administrator input. Each descriptor binds a stable resource
identifier, its canonical URI, recognized permission codes and user-facing
descriptions to the owning product capability. Client policy selects only
recognized codes and their required/optional classification. An unknown
resource or code fails closed, including when a stored client policy becomes
incompatible. No runtime generic permission-definition UI is introduced.

Work #215 delivers the authorization capability, administration and consent,
including a test-only synthetic resource with required read and optional
write to prove the complete generic contract. No synthetic test resource is
enabled in production. Work #214 remains the owner of the proposed concrete
MCP tool scope; its approved Functional Specification will determine the
actual resource URI and permission catalog/mapping for its account operations.
The proposed account summary and notification preference capabilities in
#214 are not approved by this document. Do not invent or expose a new
production product permission merely to demonstrate #215; consuming
capabilities must supply explicitly owned descriptors and enforce their
operation mapping. Any need for a real initial resource beyond the approved
delegated authorization scope returns to the functional owner.

## 4. Application responsibilities / use cases

Extend createIam and IamApplication via a focused capability contract, not a
second application factory or generic security facade.

Candidate operations cover client administration, consent preparation and
finalization, connected application queries, permission withdrawal, individual
and global revocation, delegated operation admission, account security
invalidation and provider issuance/renewal authorization.

Use existing Result conventions for expected denials. Callers obtain the
actor from trusted authentication, not a supplied user ID. Separate safe
administrative/user projections from protocol storage and secret material.
The operation responsibilities below are the proposed application contract
boundaries; the Developer may choose idiomatic local names and signatures.

### Application contract boundaries

Use explicit commands, queries and expected-failure results. The following
names describe responsibilities rather than a required class per row.

| Contract group                   | Trusted input and responsibility                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Client administration            | Authenticated administrator; register, edit, enable/disable, inspect and change platform-recognized policies. Mutations use expected revision and operation-bound confirmation when critical.                                                                            |
| Consent preparation/finalization | Verified first-party account/session plus server-resolved interaction; return safe consent projection or record explicit selection, rejecting stale state. Never accept an actor ID from form input.                                                                     |
| Connected applications           | Authenticated account; list/details, withdraw permission, revoke the selected grant lifecycle, revoke all. No provider credentials or bearer IDs in outputs.                                                                                                             |
| Issuance/renewal decision        | Trusted protocol adapter resolves the credential or pending authorization, client, resource, lifecycle and frozen entitlements. IAM evaluates current authority within the shared transaction; protocol adapter owns protocol verification and artifact writes.          |
| Final resource admission         | Verified credential provenance, intended resource, required permission and actual scope, family/lifecycle identity and entitlements. Return minimal authorized account identity and authorized operation context or refusal. No browser session ID or synthetic session. |
| Security invalidation            | IAM-internal operation on affected account/client/grant within the owning mutation transaction. Not a public transport endpoint and not an asynchronous subscriber.                                                                                                      |

The application owns permission policy and resource admission; a protocol
adapter maps its persisted credential provenance to a narrow trusted
application input. A controller must not construct an admitted actor from
unverified input. Admission does not replace the invoked use case's own
business policy; no delegated administrator contract. Do not pass arbitrary
actor identifiers from MCP tool arguments. For #214, define the trusted
resource adapter integration through these public contracts; its concrete
deployment boundary remains downstream.

Use an explicit transaction-bound application entry point for issuance and
consent, with the necessary transaction-bound ports supplied at composition.
Keep transaction-aware provider callback plumbing in infrastructure (a
request-local context such as the spike's AsyncLocalStorage is acceptable
there). IAM receives explicit ports/capabilities, not an ambient global
database or a provider object. Reuse application logic for both regular
commands and composed transaction-scoped calls, not a second IAM model or
duplicate authority implementation. A nested adapter transaction on a new
connection is forbidden in the issuance path. A missing required scope must
fail closed; no fallback to a global database connection.

## 5. Ports and external capabilities

Introduce only the boundaries needed by the use cases: transactional client
and grant state, authorization admission/read projection, protocol credential
lifecycle integration, and critical client-operation confirmation/attempt
admission as required by the final design.

Reuse existing password verification, FactorVerification and session resolution
semantics. Do not expose Kysely, Redis or OAuth library types to IAM
domain/application. Existing PostgreSQL transaction contracts are extended
deliberately where account security and grant invalidation must commit together.

## 6. Adapters and composition

Use an embedded `oidc-provider` protocol adapter composed in the
existing Fastify host, with `9.15.1` as the evaluated baseline.
Provider-specific handlers, serialization and metadata mapping stay in
infrastructure. Existing Web handles first-party login, consent, connected
applications and administration. Work #214 owns the downstream resource
boundary and uses an explicit application-owned IAM admission contract.

The spike used a minimal Node HTTP host. The Fastify integration must
establish where the provider accepts its request body, which component owns
the response and cookies, and how the per-request transaction reaches all
provider adapter calls. Prove that neither Fastify nor the provider sends
success headers, a code redirect or a token body before the applicable
transaction commits. Include commit failure, handled replay, connection loss
and the real first-party authentication bridge in the integration tests.

### Fastify protocol bridge and response ownership

Use an encapsulated Fastify plugin with an explicit route allowlist. In its
route-level `onRequest` hook, call `reply.hijack()` before parsing and pass
the Node request/response to the provider callback. The provider owns form
parsing and response emission; the separate interaction route owns its
bounded JSON. Keep first-party controllers and parsers outside this boundary.
Fastify lifecycle security hooks bypassed by hijacking must be applied before
handoff or in the protocol boundary. [P01–P04](#technical-preparation-experiments)
exercise this mechanism using Fastify 5.12.8 and oidc-provider 9.15.1.

Fastify's normal body-size limit is bypassed by the raw bridge. The provider
limits its form parser to 56 KiB. The spike enforces a one-second body
deadline in the raw bridge, including incomplete chunked input, and uses an
explicit 2 KiB cap for consent JSON. Koa's outer transaction can already
hold the fence during the form read. Bound and rate-limit ingress before
that fence in deployment, including authenticated and anonymous traffic,
and test the combined request, lock and SQL budget under contention. Ingress
buffering may reduce the time spent holding the fence, provided the buffered
form still has one parser and the response contract is retested. Resolve
metadata locally. Keep password hashing, external I/O and UI waits outside
the transaction.

The OAuth adapter's request coordinator owns the outer transaction for
protocol changes. Use public `provider.use` to wrap provider/Koa processing
while its normal response is still pending. Bind adapter and IAM calls to
the one transaction and reject calls that lack it. Custom consent routes use
`interactionResult` to obtain a redirect and emit it only after commit.
Retest this boundary when adding any provider route with a different
response mode. The spike enabled and tested query redirects and JSON only.
Provider session/interaction cookie headers also remain pending until the
relevant durable state is committed. If public hooks cannot provide this
guarantee with Fastify, stop and return to design; do not patch private
library internals or use an early response as a workaround.

On a known failed commit discard staged success status, headers, cookies,
Location and body; return a technical error (503 where appropriate).
An observed disconnect before the commit decision rolls back a normal
issuance. A lost connection after commit leaves committed state intact.
For an ambiguous commit, disclose no credentials, record non-secret
correlation and use authoritative persisted state on a subsequent request.
Never automatically retry a credential exchange after uncertain commit.
Expected replay invalidation is a deliberately committed security effect,
not a technical rollback. Only the explicitly identified replay path may
commit such an error; do not commit all provider 4xx results indiscriminately.

## 7. Data and state

Candidate PostgreSQL records: clients, client-resource permission policies,
grants and grant permissions, client/account authorization security revisions
where needed for stale consent and ABA protection, protocol interaction and
credential records, and separate critical-client attempt ledger.

Enforce uniqueness of active grant tuple with a database constraint. Use a
new non-reused grant identity on reauthorization. Retain only product data
required by the SF and applicable retention policy; account export and erasure
cover all account-linked records. Provider records must support deletion and
expiration without losing the IAM grant lifecycle.

Prefer opaque access tokens with authoritative lookup/introspection for V1.
Bind the credential to issuer, client, account, grant lifecycle, resource,
expiry and an immutable snapshot of the selected permission generations.
Give each new permission grant a non-reused generation. Consent and
issuance freeze those generations in a credential family. Renewal intersects
the original snapshot with the generations still current under IAM policy.
Final admission also checks the credential's scope against this intersection.
A regranted permission has a different generation, so old credentials retain
only still-current permissions.

### State and identity decisions

Keep business and protocol records distinguishable. The following are logical
records, not a requirement for a new repository per table or exact SQL names:

- Client and resource permission policy: stable internal client identity,
  unique public OAuth client identifier, status, optimistic revision, trusted
  redirect URIs and platform-owned resource/required/optional permission
  catalog references. Public client ID is not proof of user or client trust.
- Grant: non-reused lifecycle ID, account/client/resource tuple, status and
  timestamps. A partial unique index on the active tuple prevents duplicates.
  Each currently granted permission has a non-reused generation identity.
  Removing a permission removes its current generation; regrant creates a
  fresh identity. Do not derive the generation solely from the permission name.
- Consent freshness: capture account authorization epoch, client security
  policy revision and tuple invalidation epoch, plus exact authenticated
  session, request/resource/selection binding and expiry. Account-wide
  invalidation advances its epoch even without active grants. Client disable
  or security-relevant policy mutation advances its revision; no re-enable
  resets it. Grant/permission revocation invalidates matching pending consent.
  Keep epoch state long enough to reject all still-valid interactions. Never
  reuse a stale lifecycle or let a stale individual grant-ID command revoke
  a later grant. Repeat of an already applied targeted revocation is a no-op.
- Provider family: binds one provider Grant ID to one business lifecycle and
  one resource; immutable map of selected permission-generation identities.
  Provider artifact rows refer to family and account and have expiry,
  consumption and relevant lookup metadata. The adapter must not treat
  provider Grant scopes as an independent authorization source.
- Separate critical-client confirmation allowance: account reference and
  admitted timestamps; no password, factor, raw session ID or proof material.

Store opaque bearer lookup identifiers using keyed hashing, with domain
separation by artifact type and appropriate key management. Strip bearer
fields from payloads as established by the spike; test all persisted fields
and emitted diagnostics rather than assuming hashing the row key is enough.
Provider session and interaction identifiers also require secret-safe storage
and logging treatment. Keep keys outside database records, separate from
public issuer signing keys; design expiry and key rotation before deployment.
Use foreign keys/indexes for account, client, lifecycle and family lookup,
with explicit erasure semantics. Expiration of protocol records must not
delete the durable business grant.

A fresh authorization-code flow with a new explicit consent decision may
create a new credential family for an existing active grant. Rotation never
adds a permission generation not originally authorized for its family.
If current required permissions cannot be satisfied or no permitted scope
remains, deny renewal; otherwise preserve unaffected authorized scopes.
A scope-reduced access token carries its actually issued scope; old tokens
may remain technically present but cannot authorize invalidated entitlements.

## 8. Flows, interfaces and contracts

Use Authorization Code with PKCE S256. At the token endpoint, require an
explicit `redirect_uri` and require it to exactly match the URI bound to the code
before consumption. F02 showed that the native S256 exchange accepts omission.
Keep the guard at the protocol boundary and verify the error mapping, code
usability after denial and access to parsed parameters in the Fastify bridge.
Use pre-registered approved clients initially where interoperability allows.
Advertise required OAuth metadata and resource discovery for #214. Evaluate
CIMD only with controlled client admission, metadata trust and SSRF controls;
DCR, if needed, cannot self-approve clients. No password grant, implicit flow
or client-credentials access to user data.

Consent: validate client/resource/request, resolve first-party session, show
required/optional permissions, bind the pending interaction to the account,
client, resource, requested permissions and current invalidation state.
Finalize against authoritative state under the consistency boundary; decline/
cancel never changes existing grants. Provider consent and token issuance
must be bound to the IAM decision, with no bypass by remembered provider
consent. A code or refresh token from an invalidated lifecycle is refused.
Do not issue unrestricted tokens merely because the provider session exists.

Resource access: verify credential identity, issuer, audience/resource,
expiry and scope; evaluate IAM client, account, grant, permission and
business policy at final operation admission. Never pass an MCP access token
through to a different API audience. An already admitted operation follows
SF FR-16, not a promise of retroactive cancellation.

### Initial endpoint profile and first-party interaction

Initial #215 profile: configured issuer URI,
`/.well-known/oauth-authorization-server`, `GET /auth`, its provider-managed
resume route and `POST /token`, plus first-party consent routes. Use query
redirects, authorization code with S256 PKCE and public-client
`token_endpoint_auth_method=none`, refresh grant with rotation and opaque
access tokens. The adapter owns the discovery projection so it advertises
the exact enabled grants, query response mode and public-client
authentication method. Keep provider OIDC discovery and JWKS outside this
opaque OAuth profile. Refresh credentials survive first-party logout.
Select and register the exact redirect URI and resource identifier server-side.
Require exactly one explicit protected resource at authorization and token
exchange/renewal for this profile; reject ambiguity, unknown resource and
unapproved scopes. Require explicit matching redirect_uri on code exchange
before consumption. Keep error mapping protocol-correct and avoid redirects
to unverified client destinations.

Initially expose pre-registered approved public clients using PKCE; do not
enable public DCR, CIMD fetching, implicit/password/client-credentials grants,
OIDC UserInfo or RP-initiated logout merely because the provider supports
them. Confidential-client support, if needed, requires an explicit supported
client-authentication profile and test. Do not advertise an unimplemented
capability. Client admission is rechecked on every relevant request even when
provider metadata is cached. Token/family replay invalidation is distinct
from business grant revocation. First-party account settings own business
revocation. Do not expose a public RFC 7009 revocation endpoint in the initial
profile without defining its credential-versus-business scope and effects.
Use a trusted in-process credential-resolution/admission bridge initially;
if a separate resource server needs RFC 7662 introspection, restrict it to
authenticated authorized resource servers and the intended resource, without
granting those callers authority over IAM grants.

Work #214 verifies the profile with its chosen client(s) before real-user
distribution. If a client requires CIMD, DCR or a different endpoint profile,
review the secure admission and metadata-trust design explicitly, keeping
the approved functional rules. Do not treat client convenience as authority
to broaden eligibility. #215 must still verify its declared generic OAuth
profile using a synthetic conforming client.

First-party identity comes from the existing sid session resolution contract,
never from a provider account claim or submitted account field. Unauthenticated
users go through the existing login path with a validated local continuation;
bind a fresh eligible interaction to the actual authenticated account and
session. Capture client revision when the authorization request starts,
and account/tuple freshness on the first authenticated interaction, before
displaying consent. Restart rather than attach an old consent to a newly
authenticated session after session loss. A provider session never substitutes
for a live first-party session. Recheck session ownership, current generation,
expiry, account eligibility, client revision and pending interaction freshness
at final consent. For the cross-store session decision, use a bounded Redis
read under the authoritative account fence, with the same ordering principle
as existing operation-bound confirmation. No distributed transaction is
claimed. Consume consent once; denial/cancellation cannot mutate the grant.
Use same-origin/CSRF protection, safe return URLs, secure separate interaction
cookies, TLS and a configured trusted origin independent of request Host.
Do not persist raw first-party bearer session IDs in new protocol state;
use a server-only non-reversible session binding where correlation is needed.
Bind the pending authorization to issuer, client policy revision, registered
redirect, resource, required/requested-optional scope set, one-use nonce and
account/grant invalidation revisions. At authenticated consent entry bind the
account and keyed session identity. Consume the pending decision atomically
with grant mutation after comparing the binding to a bounded current session
read. Re-fetching a prompt cannot establish a new freshness checkpoint.
A lost or changed first-party session requires a fresh interaction and consent.

## 9. Transactions, consistency, concurrency and idempotency

Use one PostgreSQL transaction per issuance decision. Authoritatively check
the current client, account, grant lifecycle and permission generations, then
atomically consume the presented code or refresh token and persist eligible
successors. Authorization code persistence also rechecks the IAM decision.
Release the successful response only after commit. Technical failures roll
back consumption and writes. If a request proves replay, persist the
applicable protocol-family invalidation before returning its protocol error.
An independently admitted access decision always rechecks current IAM state.

Build the concrete lock order on the existing
[IAM administrative-access and account lock discipline](../architecture/iam-security.md#operation-and-concurrency-boundaries).
Specify acquisition order across account, client, grant, family and credential
rows, including deterministic ordering for multi-row paths. Prove that
client-wide fan-out and account-wide invalidation cover concurrently created
grants and never acquire locks in opposite directions. Keep network and UI
waits outside the transaction. The spike's fixture-wide fence established
ordering on one primary. Production lock granularity, contention and
deadlock/retry behavior remain open.

Account security invalidation must be part of the successful account security
transaction, with durable affected-grant facts, not an asynchronous consumer.
Focused evidence: UserEntity currently has sessionVersion; backup-code
regeneration uses MfaStore.replaceBackupCodes under an account lock without
incrementing that session generation. Therefore reusing sessionVersion as the
sole delegated revocation mechanism is insufficient. Use separate grant
lifecycle/invalidation state and explicitly integrate every SF FR-11 transition.

Client disablement and required-policy changes serialize against consent and
admission, invalidate affected grants/permissions and append durable facts.
Do not allow re-enable or permission re-addition to revive stale consent or
credentials. Grant revocation is idempotent. Credential issuance/refresh
racing with invalidation must not yield a usable new credential after the
effective invalidation point. The protocol adapter cannot be an independent
authorization authority.

Candidate approach: synchronous authoritative mutation of affected grants and
outbox in a transaction for V1, with bounded fan-out assessment. If fan-out
requires a different representation, preserve immediate effective invalidation,
permanent no-restoration semantics and grouped notification evidence; obtain
design review before changing the mechanism. Avoid eventual revocation via
outbox delivery.

### Initial production lock strategy

Choose conservative serialization for V1, deliberately based on the existing
IAM administrative-access transaction fence rather than introducing a second
uncoordinated global lock. The current
[administrative-access adapter](../../packages/adapters/iam/persistence-kysely/src/adapters/administrative-access.ts)
acquires PostgreSQL advisory transaction lock 728194002 before participating
account/configuration/credential writers. The existing
[IAM unit of work](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-iam-unit-of-work.adapter.ts)
takes that fence before the account row. The spike's fixture-wide lock is
evidence for serialization, not a production lock-order implementation.

For delegated mutations, code/refresh issuance, consent finalization and
account/client invalidation, acquire the existing fence exclusively as the
first authoritative lock. Extend participating existing security writers that
currently do not take it, notably password recovery completion and final
deletion; do not acquire it after an account row. Review deletion cancellation
and other account eligibility writers as part of the same lock inventory.
Keep existing administrative-access invariants and the existing configuration
lock order (administrative fence, configuration fence when applicable,
account). Do not create a new global lock in the reverse order.

Within the fence, acquire affected account rows in stable ID order where
required, then client rows, grant rows, provider family rows and credential
rows, each ordered by stable ID for multi-row mutation. Existing account
security operations keep their own established credential/identity ordering
under the account lock; complete account mutation and delegated invalidation
without acquiring an earlier-order lock afterwards. Provider callback writes
reuse the transaction and must not reacquire an account on another
connection. Resolve target IDs via preliminary reads only; re-read
authoritative state under the fence. Every participating path, including
cleanup/erase and administrative updates, must obey the order. Audit remaining
lock paths against the actual implementation before freezing readiness.

For read-only final delegated admission, use a short authoritative transaction
with the same fence in shared mode and current primary reads, conditional on
all relevant writers taking it exclusively. This provides an explicit
decision boundary ordered with revocation; do not upgrade a shared lock to
exclusive or hold it across the invoked business operation. If an admission
path needs writes, acquire exclusive at entry instead. Ordinary business
operations keep their own transaction and approved consistency boundaries.
Do not use asynchronous projections or lagging replicas for final decisions.
Stricter operation-specific rules may require a different boundary in their
own functional/technical owner.

For V1 bulk revocation, use indexed set-based mutation of affected active
grants/permissions in the same transaction, with `RETURNING` or equivalent
durable affected-set capture. Group facts by affected account and logical
operation. Insert the group rows into the transactional outbox before commit.
The [current outbox appender](../../packages/adapters/messaging/persistence-kysely/src/kysely-outbox.adapter.ts)
expands a multi-column parameterized values list. At 10,000 facts even seven
binds per fact exceed PostgreSQL's 65,535-parameter limit. Prefer the
set-based `INSERT ... SELECT` over the affected set, or bound each batch
inside the same transaction. PostgreSQL's documented limit applies to one
statement. [PostgreSQL 18 limits](https://www.postgresql.org/docs/18/limits.html)
A timeout or rollback leaves no partially successful revocation. Measure
representative fan-out and lock wait under concurrent account/issuer traffic;
define explicit bounded transaction and request deadlines. If the coarse
fence is inadequate, return to design for an epoch/fan-out alternative
that preserves immediate authority and durable notification evidence. No
unreviewed weakening to eventual invalidation.

### Existing lock paths and required changes

Audit baseline: `4d7e9ec0d1b75d3e7dc6c41b7165abde41700d59`. Below,
the administrative fence is the advisory transaction lock `728194002` and
the configuration fence is `728194001`. Target IDs can be discovered by
unlocked reads and must be checked again after taking the required locks.

| Existing path                                                                                                                                                                                                                                                                                                                                                                                                    | Observed order                                                                                                                                                                                                                       | Preparation consequence                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [IAM unit of work](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-iam-unit-of-work.adapter.ts#L38)                                                                                                                                                                                                                                                                                           | Administrative fence, optional user row, then transaction-bound repositories. Used by authenticated password change, suspension, reactivation, role/identity writes and verification.                                                | Invalidate only actual FR-11 transitions inside this transaction. The login identity replacement helper reacquires the same fence on the already-bound transaction. Keep that path on the existing connection.                                                                            |
| [MFA adapter](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-mfa.adapter.ts#L73)                                                                                                                                                                                                                                                                                                             | Administrative fence, user row, then enrollment/settings/backup code or challenge rows.                                                                                                                                              | Extend activation, deactivation and backup-code replacement. Leave ordinary challenge/passcode consumption outside FR-11. The MFA disable path reacquires the fence on the same transaction.                                                                                              |
| [Configuration publication](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-security-configuration.adapter.ts#L178), [step-up confirmation](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-critical-configuration-confirmation.adapter.ts#L68) and [deletion request](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-account-deletion.adapter.ts#L77) | Publication and deletion request take administrative, configuration, then relevant user rows. Step-up takes administrative then actor row. Configuration initialization takes only configuration and never waits for administrative. | Preserve those orders. Initialization may finish independently. Any future path needing both advisory locks takes administrative first. Reuse the bounded session check pattern from confirmation.                                                                                        |
| [Recovery issue and completion](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-password-recovery.adapter.ts#L40)                                                                                                                                                                                                                                                                             | Issue takes the user row. Completion discovers the user, takes the user row then the recovery row, and consumes the token in the same transaction as authenticator/user writes.                                                      | Take the administrative fence before the user row in successful recovery completion. Keep password verification and hashing before this transaction as today. Issuing a recovery token can retain its current order while it performs no delegated operation and acquires no fence later. |
| [Deletion cancellation and final erasure](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-account-deletion.adapter.ts#L171)                                                                                                                                                                                                                                                                   | Cancellation takes the user row then updates the deletion row. Erasure discovers the user, takes the user row then locks the deletion row before deleting the user and writing the witness and event.                                | Both paths must take administrative first if participating in shared-fence eligibility/cleanup. In particular, fence cancellation as an eligibility writer even though it revokes no new grant. Keep user-before-deletion-row order and never restore old lifecycles.                     |
| [Export adapter](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-account-export.adapter.ts#L14)                                                                                                                                                                                                                                                                                               | Reservation takes the user row. Reads use independent queries. Completion and download mutate or lock the export row. They take no administrative fence.                                                                             | Use an owner-bound snapshot for delegated export. If completion adds a final user/erasure guard, take the user row before the export row. Never lock user after export, because erasure deletes account-owned exports while holding user. Keep archive assembly outside locks.            |

The inversion to avoid is an account-first recovery/erase/cancellation
extension that asks for the advisory fence later while the OAuth transaction
holds the fence and waits for that account. P07 reproduced PostgreSQL
`40P01` when these two lock orders were deliberately combined. This
demonstrates the candidate integration hazard, not a claim of an existing
production deadlock. A protocol callback that opens a second connection
while the first connection holds the fence can also self-block. Thread the
transaction to all writes, including outbox, and avoid nested pool
transactions. Sort affected account IDs before row locks, then client,
grant, family and artifact IDs where required.

Use primary `READ COMMITTED` admission reads after obtaining the shared
fence in a separate statement. A snapshot captured before a fence wait
could miss the revocation just committed. Keep each statement and the
transaction within its request budget. Roll back on a known lock or
statement timeout. Retry only an operation with a known failed transaction
and applicable retry policy, never a protocol exchange after an ambiguous
commit. Verify mixed real IAM writes, concurrent creates and account-wide
erasures before using this as the production lock contract.

### FR-11 integration points and transactional authority

The following identifies the current code seams, not mandatory file-level
Task prescriptions. The application operation decides whether a real
successful security transition occurred; a transaction-bound invalidation
capability applies that effect and durable facts. No hidden rule on every
UserRepository.save, no blanket dependence on sessionVersion, no event
subscriber as the security boundary.

| Approved transition                  | Current transaction seam to extend                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Authenticated password replacement   | ChangePasswordUseCase / IamUnitOfWork.executeForUser                                                                           |
| Recovery password replacement        | ResetRecoveredPasswordUseCase / PasswordRecoveryStore.withUsableToken; add fence before account lock                           |
| Effective login identity replacement | ChangeEmailUseCase / transactional replacePreservingAdministrativeAccess; distinguish replacement from no-op/verification-only |
| MFA activation                       | MfaStore.activate atomic account/credential mutation                                                                           |
| MFA deactivation                     | MfaStore.disable atomic account/credential mutation                                                                            |
| Backup-code regeneration             | MfaStore.replaceBackupCodes; does not change sessionVersion                                                                    |
| Account suspension                   | SuspendUserUseCase / IamUnitOfWork.executeForUser; only actual transition                                                      |
| Accepted deletion request            | AccountDeletionStore.request transaction                                                                                       |
| Final erasure                        | AccountDeletionStore.eraseIfDue; extend fence and delete all linked authorization/protocol state with account erasure evidence |

Verify relevant future login-identity mutation paths also use the authorized
rule. Role change, ordinary sign-out, session expiry, individual session
revocation, failed commands and no-op operations are not additional FR-11
triggers; current policy/eligibility still constrains each access decision.
Cancellation/reactivation must never restore old grants. Keep existing Redis
session cleanup after commit and do not equate it with delegated revocation.

Critical client administration follows the existing step-up architecture:
reserve the separate account allowance in a short committed transaction;
verify current password and applicable MFA outside the final mutation
transaction; bind immutable operation, actor, session, expected client
revision, captured current security policy, monotonic deadline and security
state. Final mutation acquires the fence, checks current administrator,
session generation, authenticator and MFA identity snapshot, allowance proof,
current policy and expected revision, and performs the client mutation plus
grant invalidation/outbox within the same authoritative transaction.
Recheck the live session with a bounded Redis read; no recent-session-age
requirement beyond the SF. The two-minute deadline is exclusive, five admitted
attempts per rolling five minutes shared across sessions and client critical
operations, separate from configuration confirmation. A consumed factor or
reserved attempt is never restored after a later conflict. No reusable proof
or credential values in persistence or response.

## 10. Messaging / cross-context integration

| Contract      | Producer and consumer boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit         | IAM emits versioned, attributable facts for approved client administration, grant creation/extension, permission changes and revocation in the mutation transaction. Supply event ID, operation ID, timestamp, actor/affected-account references and minimal client/resource/action/outcome fields as appropriate. Use the existing security-denial Audit boundary for relevant denied requests with bounded reason codes. Audit controls projection, access, retention and erasure. Leave redirect queries, raw protocol errors, cookies, codes, tokens, session bindings and credential lookup hashes out of facts. |
| Notifications | Use grant creation, expansion and revocation as approved triggers. For bulk revocation, persist one source fact per `(operationId, affectedAccountId)` with a stable event ID, reason class and affected grant count. Keep unique operation/subject identity alongside event-ID deduplication so command retries and message redelivery cannot produce duplicate visible notices. Notifications resolves recipients, Web and eligible email using existing policies. It rechecks affected-user eligibility before delivery. A delivery failure has no effect on grant authority.                                      |
| Export        | IAM's account export read contract returns only the caller's eligible non-secret authorization projection from a coherent snapshot. Candidate fields are client identity/display name, resource, retained grant status and dates, and granted permission codes. Project or serialize this data explicitly rather than copying provider tables. Keep credentials, secrets, provider payloads, bindings and other accounts out of the archive. Extend the existing reserve/read/complete/download lifecycle and test export racing with erasure.                                                                        |
| Final erasure | The authoritative account transaction removes grants, families, linked provider interaction/session/code/token rows and consent revisions, and commits the existing pseudonymous erasure witness and final erasure fact. Use explicit subject linkage for all provider record kinds and clean up anonymous pending data by expiry. Existing Audit and Notifications consumers handle erasure and late facts under their own policies. The final-erasure fact creates no additional notification. Deletion cancellation leaves prior revocation in force.                                                              |

### Versioned integration facts

The proposed new IAM-owned topics below use version 1 of the existing
Messaging integration envelope (eventId, topic, version, aggregateId,
occurredAt, payload and context). Keep existing event topics/versions intact.
Inspect the current
[IAM security fact factory](../../packages/contexts/iam/src/application/events/iam-security-event.ts)
and
[IAM domain-event projection](../../packages/contexts/iam/src/application/events/iam-integration-event.ts).
Do not funnel client-wide facts through the existing domain-event mapper,
which assumes an account subject. Extend the explicit IAM application
fact projection with the needed discriminated contracts.

| Topic (v1)                         | Subject and additional payload                                                                                                          | Consumers            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| iam.delegated-client-changed       | Administrator actor as subject; clientId, change kind, revision, operationId                                                            | Audit                |
| iam.delegated-grant-created        | Affected userId; grantId, clientId, resourceId, operationId                                                                             | Audit, Notifications |
| iam.delegated-grant-extended       | Affected userId; grantId, clientId, resourceId, operationId, newly granted permission codes                                             | Audit, Notifications |
| iam.delegated-permission-withdrawn | Affected userId; grantId, clientId, resourceId, operationId, withdrawn permission codes                                                 | Audit                |
| iam.delegated-grants-revoked       | Affected userId; operationId, reason code, positive affectedGrantCount, optional clientId/resourceId/grantId when the scope is singular | Audit, Notifications |

These are technical names and explicit projections of the approved behavior,
not new product events. Client change kind distinguishes registration,
activation, disablement and actual metadata or policy change. An unchanged
command does not publish a change. Revocation reason identifies the actual
approved trigger, including required-permission withdrawal, client
disablement, policy invalidation, explicit user revocation and FR-11
security transitions. Never encode a credential, permission generation,
other affected user's identifier, raw protocol error or redirect in metadata.
Context carries the actual actor category and actorId when known, and the
subjectId; payload userId equals subjectId for the account-subject facts.
Use the affected account as aggregateId for the grouped revocation fact,
the business grant ID for individual grant facts, and the stable internal
client ID for the client fact. The client administration fact does not
pretend that the administrator's own grant was changed.

Publish one grouped revocation fact for each account with an actual revoked
grant in a logical operation, even when several grants, clients or resources
are involved. Advancing consent freshness with no revoked grant does not
create a revocation notification. A repeated request affecting no new grant
publishes none. Use stable event identities and a unique operation/subject
record for committed group facts. Do not reuse an operation identity for a
later independent revocation. Explicitly distinguish a notification-triggering
full revocation from optional permission restriction; do not add a second
revocation fact for the same transition. Existing password, MFA and other
security facts retain their original meaning and delivery policies.

Extend the existing
[Audit handler](../../packages/contexts/audit/src/application/events/audit-integration-event.handler.ts)
to validate these versions, required fields, actor/subject consistency and
bounded reason codes before effects. Use the existing personal projection
and privacy-marker rules; do not add client details to personal Audit merely
because the source fact contains them. Extend
[Notifications intake](../../packages/contexts/notifications/src/application/intake/notification-event-handler.use-case.ts)
and its [policy owner](../../packages/contexts/notifications/src/application/policies/notification.policies.ts)
for the three approved notification-triggering topics. Use affected-user
Web inbox creation plus mandatory eligible email (the existing Web inbox
is a notification record, not a separate email-like delivery channel).
Reuse atomic createForEvent consumption and delivery-time erasure eligibility;
no generic inbox, additional administrator audience or new delivery channel.
No late replay may restore a directly identifying Audit reference or an
ineligible affected-user delivery. Consumers validate their local versioned
contracts without importing IAM internals or sharing a domain model.

### Export and erasure projection

Extend the existing versioned IAM archive with an explicit
delegated-authorizations collection. Include only the owner's retained
grant records: non-secret application identity/display information,
resource identifier, grant state, grant/revocation dates and applicable
permission codes. Do not export permission generations, technical family
or provider identifiers, protocol payloads, session bindings, keys or lookup
hashes. Use one coherent owner-bound read snapshot for the IAM authorization
projection; do not claim an atomic cross-context archive snapshot.
Recheck current owner, export reservation and account erasure eligibility
when completing the archive; use account-before-export lock order and no
new connection inside the authoritative fence. If the reservation/account
was erased, discard assembled bytes and do not recreate the reservation
or generated fact. Preserve existing one-time download and expiry behavior.
Final erasure removes every account-linked grant and protocol record in the
existing transaction, keeping only independently justified retained Audit
evidence under its owner. Replay and queued delivery tests exercise the
existing privacy marker and erasure witness, not a competing tombstone.

Production proof must include duplicate publication, failed delivery,
account deletion with queued delivery, and replay of facts after erasure.
The synthetic grouped outbox assertion and F10 fixture erasure are evidence
for the proposed boundaries. They do not exercise these production consumers.

## 11. Security and privacy

Reuse operation-bound confirmation concepts from
[TD-CRITICAL-CONFIGURATION-STEP-UP-001](TD-CRITICAL-CONFIGURATION-STEP-UP-001.md),
not its configuration-specific allowance or recent-authentication constraint.
Candidate request-local proof: exact actor, originating session, operation and
expected client revision; monotonic ingress time; separate account attempt
ledger; current password and current MFA; final authoritative security/session
comparison. Backup-code identity changes invalidate proof; ordinary factor
consumption is not itself a security-state replacement. Do not persist proof
secrets, reset session age or share the allowance with configuration publication.

Require TLS, exact redirect URI validation, PKCE, CSRF and interaction replay
protection, issuer/resource binding, controlled metadata retrieval, secret
redaction, least privilege, token rotation/reuse handling and bounded abuse
controls. Do not rely on JWT expiry alone for immediate revocation.

### Initial credential and key policy

The tested technical defaults are code 5 minutes, consent 10 minutes,
opaque access 10 minutes, refresh idle 30 days and absolute credential
family 90 days. The IAM business grant remains valid under the approved
functional lifecycle. Provider TTL hooks set the per-artifact defaults.
Preserve the refresh token's original issue time across rotation, cap renewal
at the remaining absolute family lifetime, and check the persisted family
deadline at final admission and lookup. At family expiry, require fresh
eligible consent to create a new family. P04 verified the per-artifact TTLs,
renewal cap and independent IAM grant. Test shorter remaining deadlines in
production response metadata as well as admission.

Use deployment-managed, versioned key material, shared across issuer
replicas. Keep independent keys for provider signing, provider cookie
signatures, opaque credential HMAC lookup and first-party consent binding.
Reload all instances before switching the active write/signing key. Keep
prior verification keys only through the bounded window of affected
artifacts, or deliberately invalidate the affected technical credentials
when incident policy requires it. Use a provider cookie key ring with the
active key first. P08 exercised overlap and old-key retirement without
interrupting valid opaque credentials. Keyed token indexes need an explicit
current/previous lookup plan because a new HMAC cannot be derived from an
old index entry alone. Use bounded version-specific lookups, write with the
active key and retire the old key after the last usable family and replay
window have drained. Keep signing key IDs stable across replicas. Keep
private JWKs and HMAC secrets out of responses and logs. The OAuth-only
profile issues no OIDC ID token and exposes no public JWKS endpoint.

Use distinct scoped, HttpOnly, SameSite provider cookies and require Secure
under the configured TLS origin in production. Confirm rotation overlap and
rollback in the deployed topology, lookup-HMAC rotation, network proxy
trust, SameSite behavior on actual navigation and emergency key revocation.
The loopback test verifies signed interaction cookies and path ownership.
TLS termination and secret-manager integration need separate evidence.

## 12. Migration and compatibility

Pre-production breaking changes are acceptable within approved scope. Extend
the target schema and application contracts directly, without legacy facades
or competing models. Preserve unrelated account data and approved behavior.
Migration rehearsal must verify schema constraints and upgrade behavior; no
silent destructive reset.

## 13. Performance and operational limits

Measure client-wide and account-wide invalidation fan-out, lock contention,
grant admission lookup latency, token lookup and expiry cleanup, outbox size
and notification grouping. Index active grant tuple and lookup by account and
client. The credential lifetimes are defined in section 11. The following
are initial engineering guardrails and validation targets, not product
limits, availability guarantees or measured production SLOs.

- Keep the tested 56 KiB provider-form cap, 2 KiB consent body cap and one
  second raw-body read deadline. Configure ingress size, rate and concurrency
  protection before requests can occupy the shared IAM fence; do not trust
  the framework's bypassed parser limit.
- Use transaction-local PostgreSQL timeouts and one monotonic request
  deadline. As initial integration-test settings, use a 500 ms lock-wait
  cap, 2 s statement cap, 4 s transaction cap and 6 s request budget for the
  delegated protocol and final mutation transaction paths, bounded further
  by the applicable confirmation/interaction deadline. Keep the existing
  bounded session read at no more than 2 s and the remaining request budget.
  Tune these settings against the actual ingress, pool and deployment
  constraints; do not override unrelated existing IAM confirmation policy.
  Start no additional SQL work after budget exhaustion. Enforce total
  transaction lifetime, not only per-statement timeout; avoid application
  timeout races that leave an unchecked transaction running.
- On a known timeout/failed transaction, fail closed with no success or
  credentials and no partial revocation. A commit whose result is unknown
  is handled by the ambiguous-commit contract, never assumed rolled back.
  Bound and clean up connections; do not automatically repeat spent codes.
- Re-run the 1,000- and 10,000-account/three-grants-per-account cases with
  actual IAM repositories and outbox schema, representative concurrent IAM
  writers and admissions, multiple issuer processes, and repeated runs.
  Record p50/p95/p99 latency, lock wait, timeout/deadlock counts, affected
  facts and rollback behavior. Verify set-based or parameter-bounded writes
  in one transaction and exact grouping. Verify admitted operations respect
  the effective invalidation order. Do not claim that a single 150.1 ms
  fixture SQL run establishes production capacity.
- Before activation, establish the measured operating envelope and
  configured ingress/concurrency budgets from those results. If expected
  authorized bulk operations cannot fit a bounded transaction with
  acceptable contention, return to Technical Design for the alternative
  invalidation representation described in section 9. Do not silently
  impose a business account/grant quota, split a revocation into partially
  committed batches or replace synchronous authority with eventual delivery.

These initial settings are subject to integration measurement and focused
design review; exact tuning is a local implementation/operations decision
within the same security and atomicity guarantees. Changing those guarantees
requires upstream review. Fail closed on unavailable authorization decisions.

## 14. Error and failure handling

Map expected consent denial, invalid client/resource, insufficient permission,
stale consent or revision, revoked grant, confirmation refusal and exhausted
allowance to explicit application results and standard protocol/HTTP errors
at adapters. Unexpected persistence, provider or verification infrastructure
failures remain technical failures. Never report revocation success before
effective invalidation is established. Notification failure cannot undo a
committed security mutation.

## 15. Validation strategy

Use the repository testing owner. Plan domain tests for grant/policy rules,
application tests for authorization and errors, PostgreSQL integration tests
for every FR-11 transaction, uniqueness, disable/re-enable, permission
remove/re-add, stale consent, issuance/refresh races and rollback/outbox.
Test exact step-up deadline, five-attempt window, cross-session concurrency
and security-state changes. Exercise Web administration, consent, connected
applications, export/erasure, audit and grouped notification replay.

Protocol experiment must establish PKCE, partial scopes, issuer/resource
binding, controlled registration, consent reuse prevention, provider storage,
refresh/revocation and failure behavior. Test against ChatGPT and a second
compatible MCP client when #214 integration is available; use synthetic test
accounts before real user exposure. The isolated protocol results appear in
[executable feasibility evidence](#executable-feasibility-evidence).

### Integration evidence boundaries

Map FR-01–FR-16 and the 43 approved criteria to focused domain, application,
API/Web and PostgreSQL/Redis integration tests; record actual execution, not
only coverage percentages. Add a provider/Fastify compatibility test for the
exact pinned version, request body ownership, normal success, code redirect,
headers/cookies, rollback and commit failure, response disconnect and replay
error commit. Prove all protocol and IAM writes share one connection and that
no success bytes escape before commit. Exercise at least two independent
processes for code redemption, refresh, revocation and consent races.

Use the real production persistence paths for every FR-11 trigger, including
backup-code regeneration, no-op/failure cases, final erasure and concurrent
consent with account/client invalidation. Exercise lock order with existing
configuration, recovery, deletion, account administration and MFA writers.
Verify fan-out with representative synthetic volume, grouped notifications and
outbox rollback; retain a recorded latency/lock-wait baseline rather than
claiming unmeasured scalability. Test security and privacy boundaries,
account isolation, stale consent, no credential leakage and export/erasure
including provider records and replayed facts. Validate the declared OAuth
profile with a synthetic client; actual MCP interop is #214. Verify exact
deployed LTS image before OAuth activation.

Use repository-owned commands (including pnpm build, typecheck,
typecheck:test, lint, ci:test, ci:test:integration, format:check, docs:links
and applicable targeted workspace tests). Required Quality checks and the
external SonarCloud Code Analysis check must pass for the current candidate
before merge. The tolerated Actions Sonar job is not an exception to that
policy. Re-run candidate-bound evidence after changes. The synthetic evidence
in section 16 covers the fixtures and candidate profile.

## 16. Provider feasibility

The [accepted ADR](../architecture/decisions/0012-oauth-authorization-server-integration-and-grant-authority.md)
compares the preferred embedded integration with alternatives. Re-evaluate
the chosen provider/version at integration against the exact endpoint profile
needed for #214.

References:
[node-oidc-provider](https://github.com/panva/node-oidc-provider),
[Hydra OSS MCP guide](https://www.ory.com/docs/guides/mcp/hydra-oauth-oss),
[Hydra OEL MCP guide](https://www.ory.com/docs/guides/mcp/hydra-oauth-oel),
[MCP authorization](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/index.mdx),
[OpenAI authentication](https://developers.openai.com/plugins/build/auth).
Documentation evidence only, consulted 2026-11-26.

### Version-pinned feasibility findings (static inspection)

The evaluated release is `oidc-provider@9.15.1` (MIT, 2026-11-20). Its
tagged source uses ESM JavaScript. Confirm TypeScript declarations and the
Fastify contract as part of integration preparation.

| Boundary         | Observed source capability                                                                                     | Required project-specific proof                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent          | Custom interactions, findAccount, loadExistingGrant; provider Grant has per-resource accepted/rejected scopes. | Mandatory/optional classification, final consent check, account binding, no stale remembered consent, repeated optional-scope request.             |
| Client admission | Client adapter lookup; CIMD allowFetch and allowClient (including cached metadata).                            | Reject unknown/disabled clients at all relevant endpoints, even cached; no metadata-based self-approval.                                           |
| Resource         | resourceIndicators.getResourceServerInfo, defaultResource, useGrantedResource; PKCE policy.                    | Single intended resource, enforce S256 and scope policy, no cross-resource credential reuse.                                                       |
| Issuance         | Authorization-code and refresh handlers load provider Grant and validate account.                              | Every code/refresh issue and persistence path subordinate to current IAM authorization; concurrent invalidation cannot return a usable credential. |
| Storage          | Adapter contract includes upsert, find, consume, destroy, revokeByGrantId and lookup methods.                  | Atomic consume rejects reuse by throwing, not returning false; hashed bearer lookup keys where compatible; expiry, erasure, replica/race behavior. |
| Introspection    | Valid token and provider grant checks plus allowedPolicy; opaque token format supports extra claims.           | Authenticated resource-server caller, safe projection, current IAM admission with precise lifecycle/resource/scope binding.                        |
| Session          | Default expiresWithSession and initial refresh issuance depend on offline_access.                              | First-party sign-out preserves business grant and valid delegated credentials; consent still requires live first-party session.                    |

Tagged evidence:
[package manifest](https://github.com/panva/node-oidc-provider/blob/v9.15.1/package.json),
[configuration hooks](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/helpers/defaults.js),
[grant model](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/models/grant.js),
[authorization code](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/actions/grants/authorization_code.js),
[refresh](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/actions/grants/refresh_token.js),
[grant source checks](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/helpers/grant_source.js),
[opaque format](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/models/formats/opaque.js),
[introspection](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/actions/introspection.js),
[adapter contract](https://github.com/panva/node-oidc-provider/blob/v9.15.1/example/my_adapter.js),
[revocation helper](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/helpers/revoke.js).

### Provider lifecycle constraints

The provider Grant can contain scopes for several resources, and the default
`loadExistingGrant` may reuse the provider session's grant. Use custom
interactions, a lookup restricted to the current IAM consent result, and an
authoritative client check even when the provider caches metadata. Disable
development interactions and flows outside the exposed endpoint profile.

The provider's refresh handler checks requested scopes against the old refresh
token and builds a rotated token carrying the original refresh scope. Current
provider-grant scope filtering does not by itself prove that a removed and
regranted permission cannot reappear through an old credential. A revision
claim on an access token alone is insufficient: extraTokenClaims in the opaque
format applies to access tokens and client credentials, not refresh tokens.

Use the permission generations in [data and state](#7-data-and-state) when
projecting provider scopes. Provider existence, expiry and client checks
are protocol checks. An account lookup alone cannot serialize issuance
against concurrent invalidation. Bind the guarded storage adapter to the
[issuance transaction](#9-transactions-consistency-concurrency-and-idempotency)
and retain the final IAM admission check regardless of cleanup timing.
Use keyed bearer lookup hashes and strip bearer identifiers from persisted
payloads, logs, export and audit.

Protocol replay invalidates the affected credential family. IAM separately
owns business grant revocation and the synchronous invalidation boundary.
Configure expiry and refresh eligibility independently from first-party
session lifecycle, including the provider defaults tied to `offline_access`.

### Bounded executable feasibility experiment

Use an isolated disposable workspace with exact oidc-provider 9.15.1,
synthetic account/client/resource data, a minimal protocol host and a
PostgreSQL-backed adapter experiment. Keep product dependency manifests,
runtime and approved behavior unchanged. Record Node/pnpm versions, dependency
lock, commands, expected and observed outcomes. Use direct OAuth requests or
an OAuth client harness, plus a mocked resource-server admission boundary
using the same authoritative data; do not require real account data or
ChatGPT credentials.

| Case | Required evidence                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01  | Custom first-party login/consent binds actual authenticated account; read accepted, optional write declined; returned scopes and admission match. |
| F02  | Code exchange requires correct S256 verifier, client and redirect URI; concurrent redemption admits at most one exchange.                         |
| F03  | Reject unapproved/disabled client, wrong resource, unknown/disallowed scopes; cached client cannot bypass disablement.                            |
| F04  | Declined extension leaves existing grant unchanged; new consent can extend it; stale consent after revocation cannot recreate access.             |
| F05  | Revoke after authorization code issue, before exchange; old code/refresh and access admission fail after effective invalidation.                  |
| F06  | Remove write then regrant it; old access and refresh lineage cannot recover write; test unaffected read continuity and new consent.               |
| F07  | Concurrent refresh/revocation and refresh replay, including two processes; no usable credential issued from invalidated lifecycle.                |
| F08  | Re-enable client or reactivate account; old credentials remain unusable; new authorization has distinct identity.                                 |
| F09  | Sign out or expire first-party session; independently valid grant/credentials continue; stale pending consent fails.                              |
| F10  | Storage failure, restart, expiry/erasure and guarded persistence; fail closed, no raw credentials in outputs.                                     |

### Executable feasibility evidence

Work #215, Technical Design / Feasibility, Software Architect. The maintainer
authorized the bounded spike for [draft PR #216](https://github.com/Oxelio/architecture-web/pull/216)
at baseline `c42356a17c224ae3323002bc425d3746b932c93e`; the live Project #3
Status was Preparing. Evidence was produced on 2026-11-26 by the
[isolated experiment](../../scripts/spikes/delegated-authorization/README.md)
and its [executable assertions](../../scripts/spikes/delegated-authorization/feasibility.test.mjs).

Observed environment: `oidc-provider@9.15.1`, `pg@8.16.3`, npm `11.19.1`,
and PostgreSQL `18.6` on Linux/amd64 (Debian `18.6-1.pgdg13+2`). The
[dependency lock](../../scripts/spikes/delegated-authorization/package-lock.json)
and spike README pin the dependency tree and database image digest. The verified
clean reinstall used `npm ci --offline --ignore-scripts --no-audit --no-fund`.
The final runs used a clean lockfile install and the commands in the spike
README. The root project declares pnpm `12.21.0`. The spike uses its own
npm lockfile and sits outside the pnpm workspace. Nodes `24.15.0`, `26.8.1`
and `26.13.1` each passed 12 of 12 tests covering F01–F10, including the
native redirect control and both F06 models.

| Case | Expected boundary                                                                                           | Observed in the fixture                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01  | Authenticate through the first-party boundary and grant only accepted permissions.                          | The login hook bound Alice from the session even when the submitted body named Bob. Consent showed required `read` and optional `write`. Accepting only read returned scope `read`; write and wrong-account admission were denied. Switching the session owner during consent was rejected. Declining required read returned `access_denied`.                                                                                                                                                            |
| F02  | Require S256, verifier, issuing client and matching redirect; one atomic redemption.                        | Plain/missing PKCE, wrong verifier, other registered client and mismatched redirect were denied. The native control accepted an omitted redirect for the S256 exchange. The spike guard refused the omission. Two issuer processes returned one 200 and one `invalid_grant` for the same code. Two direct PostgreSQL consume calls without the request fence produced one winner and one rejection.                                                                                                      |
| F03  | Enforce client admission and resource/scope binding despite cached provider metadata.                       | Unknown and disabled clients, missing/wrong/multiple resources and requests with unknown/disallowed or missing required scopes were rejected. A warmed client could neither authorize nor exchange/refresh after disablement; existing access was refused. Wrong resource at exchange, renewal and admission was denied. Dynamic registration was disabled.                                                                                                                                              |
| F04  | Require explicit extension and preserve existing state on denial. Stale consent must not recreate a grant.  | Repeated requests went through explicit consent. Decline preserved the prior read grant. Concurrent explicit extensions kept one active IAM grant and did not widen old access. Revocation defeated both a displayed prompt and a request whose prompt had never been displayed, and prevented code issuance if it occurred after approval but before resume.                                                                                                                                            |
| F05  | Revocation denies a code issued before exchange, older refresh and old access.                              | After revocation committed, exchange and refresh returned `invalid_grant` and access admission denied the still-persisted token.                                                                                                                                                                                                                                                                                                                                                                         |
| F06  | Old credentials never recover a withdrawn and regranted write permission. Compare read continuity.          | Generations preserved old read access, renewed read-only across withdrawal and regrant, and narrowed a pre-withdrawal code to read. Explicit old-lineage write renewal failed. Whole-family invalidation denied old mixed-scope access, code and renewal, including unaffected read on that family. An independent read-only family survived both modes. Fresh consent obtained write, and required read withdrawal revoked the resulting grant.                                                         |
| F07  | Rotation, replay containment and a consistent revocation boundary across processes.                         | Two issuer processes racing the same refresh returned one 200 and one `invalid_grant`. Replay invalidated the rotated family and preserved a separate family and the IAM grant. PostgreSQL lock-wait assertions established both revocation/renewal orders. Revocation-first denied renewal. Issuance-first could return 200, but after revocation committed the returned access and refresh were unusable.                                                                                              |
| F08  | Permanent invalidation across client re-enable or account reactivation.                                     | Disable/re-enable and suspend/reactivate each denied old access, refresh and pending consent. After fresh consent, three lifecycles had three distinct IAM grant IDs.                                                                                                                                                                                                                                                                                                                                    |
| F09  | Ordinary session loss leaves independent delegated credentials valid; pending consent needs a live session. | Deleting the synthetic Web session blocked submission of pending consent and preserved access. Expiring its replacement also blocked consent. After deleting provider-session rows, the prior refresh token still rotated and the new access token was admitted.                                                                                                                                                                                                                                         |
| F10  | Fail closed, atomic storage, restart, expiry and linked erasure without bearer leakage.                     | SQL errors in admission and credential persistence returned technical failures. A deferred-constraint commit failure returned 503 without tokens. Code consumption and refresh rotation were retryable after rollback. A replacement issuer resumed an interaction and used persisted tokens. Expired code/access were refused. Account deletion removed linked fixture records and blocked old refresh/consent. Sampled bearer values were absent from stored artifact rows and captured issuer output. |

### Observed integration mechanics

- Custom interaction policy, `interactionDetails`/`interactionResult`,
  `loadExistingGrant`, `findAccount`, resource indicators and the public
  adapter interface were sufficient for the exercised OAuth-only profile
  without patching the library. The experiment waits for commit before
  sending the interaction redirect. It leaves protocol replay invalidation
  committed on its expected `invalid_grant` path and rolls back technical
  failures. SQL fencing, current grant use, protocol writes and consumption
  share the same request transaction.
- Each accepted interaction creates a subordinate provider Grant/credential
  family bound to one IAM grant lifecycle and resource. Consent freezes only
  the selected permission generations. The adapter projects allowed resource
  scopes at provider Grant lookup and checks code, access and refresh writes.
  The mock resource boundary independently compares the presented scope and
  the frozen generations against current IAM state. Successful protocol
  persistence alone cannot establish resource admission.
- Rotation retains the upstream refresh payload's original scope. The
  immutable family snapshot and projected Grant constrain it, including
  after regrant. The configured adapter reads the pinned opaque payload fields (`jti`, `resources`,
  `grantId`, resource/audience, account and client). Keyed hashing of the
  artifact row identifier alone left a raw `jti` in the payload in an
  earlier run. The adapter now strips it before storage and restores it from
  the presented credential only at lookup.
- The tested request wrapper uses public `provider.use` and
  `Provider.ctx`. Strict redirect presence in the spike reads the parsed
  redirect during code consumption. Grant scope projection, parsed request
  fields and the rollback/commit behavior around provider error handling
  remain version-sensitive contracts. Adapter callbacks by themselves
  provide no cross-call transaction. The spike deliberately tested commit
  failure after provider success had been calculated.

### Node.js compatibility

The [pinned provider entry point](https://github.com/panva/node-oidc-provider/blob/v9.15.1/lib/index.js)
checks `process.release.lts` at import. It logs a warning for a build without
an LTS codename or one that predates its Node 22 LTS minimum. Node 26.8.1 was
published as a Current build, before the Node 26 line entered LTS. Its test
run completed despite the warning.

| Exact Node build                                       | Observed `process.release.lts` | Provider warning | F01–F10 suite |
| ------------------------------------------------------ | ------------------------------ | ---------------- | ------------- |
| [24.15.0](https://nodejs.org/en/blog/release/v24.15.0) | `Krypton`                      | Absent           | 12/12         |
| [26.8.1](https://nodejs.org/en/blog/release/v26.8.1)   | Absent                         | Present          | 12/12         |
| [26.13.1](https://nodejs.org/en/blog/release/v26.13.1) | `Lithium`                      | Absent           | 12/12         |

The warning creates no project-wide runtime upgrade requirement for Work
#215. Node 24.15.0 is already covered by the repository's engine range and
compatibility CI. The current API Dockerfile uses Node 26.8.1 for its build
stage and a separate Distroless Node 26 runtime image. On 2026-11-26 the
Dockerfile's runtime tag `gcr.io/distroless/nodejs26-debian13:debug-nonroot`
resolved to `sha256:9a4f8edc7ad17de23070f6991b43362b6de4c0c0c586c7f5b3153922462f1b02`.
A network-disabled version probe of the Linux/amd64 image reported Node
26.13.1 `Lithium`. The exact image used
to deploy OAuth must be checked again because the Dockerfile tag can move.
Use a supported LTS build whenever the provider runs in production. If the
OAuth host will use 26.8.1, select an LTS build before deployment. Keep the
existing project runtime settings during this preparation.

### Technical preparation experiments

The follow-up at baseline `4d7e9ec0d1b75d3e7dc6c41b7165abde41700d59` used
oidc-provider 9.15.1, pg 8.16.3, Node 26.13.1 LTS and the same digest-pinned
PostgreSQL 18.6 primary. It first exercised Fastify 5.10.0, the API's locked
version at that baseline. The final isolated lock and rerun use Fastify
5.12.8. The
[reproduction commands](../../scripts/spikes/delegated-authorization/README.md#fastify-preparation-and-fan-out)
run the unmodified protocol regression cases through both hosts. The raw
Node host passed 12/12. The Fastify host and bulk SQL tests passed 21/21.
Tests exercise synthetic IAM and first-party sessions on loopback.

| Case    | Expected boundary                                                                                     | Observed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01     | Single parser and response owner, exact endpoint profile, transactional redirect and cookie emission. | Real URL-encoded exchange and query redirect succeeded. The token endpoint refused JSON, a 57 KiB form and omitted resource, with the code/refresh still usable on a correct retry. The allowlist hid OIDC, registration, introspection, logout and revocation routes. Signed, path-scoped HttpOnly cookies accompanied authorization. A deferred failure during consent rolled back IAM grant, provider Grant, family and the one-use decision. A subsequent successful consent followed by a failed code commit yielded 503 with no Location, Set-Cookie or durable code. |
| P02     | No early response and explicit connection-loss outcomes.                                              | Pausing before commit produced no response headers and no externally visible credential row. Disconnect before the commit decision allowed the same code to be redeemed after rollback. After a known commit, an intentionally dropped response produced no client headers but left one durable credential. Retrying the spent code returned invalid_grant and applied replay cleanup. F07/F10 also ran through Fastify and exercised rotation, replay and SQL/commit rollback.                                                                                             |
| P03     | A partial form read cannot hold the request fence indefinitely.                                       | The raw one-second deadline cut off a partial chunked form and a subsequent credential exchange succeeded. This is a bounded, single-connection test with no ingress proxy.                                                                                                                                                                                                                                                                                                                                                                                                 |
| P04     | Technical expiry applies independently of IAM.                                                        | Code and interaction persistence reflected 300/600 seconds; access reported 600 seconds; refresh idle was 30 days and rotation respected the original issue-time cap. An expired family denied access and renewal while the business grant remained active.                                                                                                                                                                                                                                                                                                                 |
| P05–P06 | Synchronous invalidation and one grouped durable fact per affected account.                           | Set-based update/RETURNING/grouped insert rolled back both grant mutation and outbox effects when an outbox constraint failed. After commit the shared-fence reader saw zero affected active grants and unrelated rows survived. Retrying the same completed operation inserted no new rows. One account with 53 grants across clients/resources yielded one grouped fact.                                                                                                                                                                                                  |
| P07     | Opposite lock order produces a real database deadlock.                                                | PostgreSQL returned 40P01 for one of two transactions attempting account-before-fence and fence-before-account in parallel. The synthetic test establishes the hazard, while the source inventory identifies the production seams to change.                                                                                                                                                                                                                                                                                                                                |
| P08     | Cookie key rotation preserves the independent token authority.                                        | A second Fastify issuer with active-plus-previous cookie keys completed an old interaction. An issuer with only the active key rejected an old pending interaction. The existing opaque refresh credential still rotated.                                                                                                                                                                                                                                                                                                                                                   |

The Fastify 5.12.8 rerun, with three grants per affected account and an
unrelated control population, is recorded below. Wall-clock values are from
a disposable workstation PostgreSQL instance. Rows model group counts and
operation/account deduplication, without production outbox JSON serialization
or downstream delivery. The hold interval includes the contention probe.

| Affected accounts | Revoked grants | Grouped facts | Mutation SQL | Exclusive fence held | Competing shared admission waited |
| ----------------: | -------------: | ------------: | -----------: | -------------------: | --------------------------------: |
|             1,000 |          3,000 |         1,000 |      17.6 ms |              41.6 ms |                           33.6 ms |
|            10,000 |         30,000 |        10,000 |     150.1 ms |             191.9 ms |                          185.6 ms |

The account-wide sample took 8.9 ms for 53 grants and one fact. The earlier
5.10.0 run recorded a 233.0 ms admission wait for 10,000 accounts, illustrating
why fence wait time belongs in the operational budget.
Benchmark the real outbox schema and actual IAM writer mix with repeated
runs, larger sets, queue backlog and latency distributions. Choose the
bounded V1 operating envelope from those measurements before relying on
the coarse fence for a deployment.

### External SonarCloud analysis

The [original informational job](https://github.com/Oxelio/architecture-web/actions/runs/45888724424/job/140147089969)
at `fca0d8f92a12f5c87e50dfcff8a8404705d3e514` reported a failed gate even
though Repository CI concluded successfully. The external PR 216
[gate](https://sonarcloud.io/dashboard?id=Oxelio_architecture-web&pullRequest=216)
and its `qualitygates/project_status`, `measures/component_tree` and
`issues/search` APIs were read during this preparation. The returned gate was
ERROR. New coverage was 0.0% against 80%, with 43, 75 and 156 uncovered
executable new lines in adapter, database and issuer (274 total).
New security rating was 2 against a maximum of 1. The API returned one
vulnerability, `javascript:S5332`, on the issuer's original origin comparison
built from the raw Host header. Reliability, maintainability, duplication
and reviewed hotspot conditions passed in that snapshot.

The fixture now compares the consent POST origin to the configured loopback
listener origin. The latest local Fastify/SQL run produced real native LCOV
for all four spike source modules, with 97.13% line and 93.85% branch coverage
in the Node report. These figures are local native coverage, distinct from
SonarCloud's new-code metric. Repository CI's existing LCOV aggregate did
not run/import the isolated suite. Bring the portable repository-relative
LCOV from a controlled PostgreSQL/Fastify validation job into the candidate
aggregate and re-run the external analyzer. Verify issue closure and actual
import on the exact PR head. Keep source scope, thresholds, external check
requirements and Sonar policy in force. This preparation supplies the
reproducer, diagnosis and coverage producer, while CI ingestion remains
open.

### Fastify dependency review

[Dependency review on the first preparation push](https://github.com/Oxelio/architecture-web/actions/runs/45892925518/job/140159817497)
rejected the fixture's Fastify 5.10.0 pin for four high-severity advisories.
Fastify identifies 5.12.2 as the first patched version for those reports.
The isolated npm lock was updated to 5.12.8. The isolated
`npm audit --audit-level=high --omit=dev` reported zero vulnerabilities.
The fixture lockfile Git blob changed from
`fa611ee949b72647265ac0cd4a41cac3b1f8d7cb` to
`a9afeeff88d1ef0696e07078dae193817f160121`.
The root pnpm lock and API manifest still resolve Fastify 5.10.0 at the
preparation baseline (lockfile blob `6a46ef977b5fe3edc186511dbf6ab9d16bc0cb2e`).
Verify and upgrade the actual API dependency before
integrating the production bridge. The fixture patch supplies compatibility
evidence for the newer version. [GHSA-9q9j-q6p8-xq58](https://github.com/fastify/fastify/security/advisories/GHSA-9q9j-q6p8-xq58),
[GHSA-hwr6-493r-vm6h](https://github.com/fastify/fastify/security/advisories/GHSA-hwr6-493r-vm6h),
[GHSA-p68q-wchp-6fh7](https://github.com/fastify/fastify/security/advisories/GHSA-p68q-wchp-6fh7),
[GHSA-667r-xxjv-c9mm](https://github.com/fastify/fastify/security/advisories/GHSA-667r-xxjv-c9mm).

### Remaining integration boundaries

The experiments established ordering under fixture locks on one PostgreSQL
primary, reported a real reversed-order deadlock and measured synthetic
fan-out. Production IAM transaction combinations, performance budgets,
read replicas and the lock duration under deployed ingress require separate
evidence. The resource endpoint is a mock. Issuer restart used the same
database and keys.
Database failover, ambiguous commits, backup/restore, key rotation, and
production TTL/purge policies require separate evidence. Erasure covers the
fixture's linked rows and outputs. Production Audit, Notifications, export,
backup retention and the erasure witness remain with their existing owners.

The tested profile starts from synthetic first-party sessions, static public
OAuth clients, one resource and two permissions. The real Fastify/Web
composition needs its existing session resolver, trusted proxy/TLS wiring,
CSRF protection, cross-account provider-session transitions and production
Kysely transaction propagation. Validate the chosen error mapping against
#214 clients. Review any proposed DCR/CIMD, introspection, RP logout or
RFC 7009 addition as a separate endpoint profile extension with its own
authority and tests. Full SF acceptance and production proof for every
FR-11 transition remain downstream validation activities.

## 17. Accepted architecture decision

[ADR-0012 — OAuth Authorization Server Integration and Grant Authority](../architecture/decisions/0012-oauth-authorization-server-integration-and-grant-authority.md)
records the accepted structural decision and the current-state owners to
synchronize when the target becomes effective. The maintainer accepted the
exact ADR candidate in PR #216 at fca0d8f92a12f5c87e50dfcff8a8404705d3e514;
see the [acceptance record](https://github.com/Oxelio/architecture-web/issues/215#issuecomment-7202625547).

## 18. Risks and unresolved technical decisions

The accepted structural decision is resolved. This amendment proposes the
production boundaries, contract responsibilities, conservative lock order,
initial endpoint profile and state/credential policy. The design remains
Proposed pending focused technical review and execution planning. The
integration-fact contracts, resource catalog ownership and initial operational
guardrails are specified above; do not infer Readiness from ADR acceptance.

| Finding                                                                                                                          | Owner / disposition                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production Fastify composition, real first-party session and Kysely transaction, ingress and client/server failure boundaries    | Software Architect / carry the tested public bridge and commit/failure assertions into production validation                                                                      |
| Production lock inventory integration, bounded ingress and database budgets, outbox parameter limits and large-client contention | Software Architect / implement only after authorized planning; verify the real adapter paths against the recorded acquisition order and measure the operating envelope            |
| Consent revision/session binding, deployed key rings and provider API typing                                                     | Software Architect / apply the tested technical lifetime and endpoint settings, verify TLS and versioned lookup key rotation, and exercise real session and client policy changes |
| Actual Audit, Notifications, export and erasure projections                                                                      | Product/Domain Analyst and Software Architect / confirm the versioned contracts within approved scope; prove consumer replay, delivery eligibility and the export/erasure race    |
| Exact deployed LTS image and production failure/latency evidence                                                                 | Validation / before activation; no project-wide runtime change currently justified                                                                                                |
| Actual ChatGPT and second MCP client interoperability                                                                            | #214 / downstream; #215 owns declared OAuth profile and compatibility contract                                                                                                    |
| External SonarCloud PR check                                                                                                     | Review/Validation / integrate the spike LCOV report into candidate-bound CI and verify the external gate and the S5332 result for the current head                                |

Full implementation proof is not a prerequisite to choosing a structural
direction, but material unresolved decisions cannot be delegated silently to
the Developer. If bounded integration evidence contradicts the accepted
architecture, escalate to its structural owner; if it requires different
observable behavior, escalate to the approved functional owner. No new Work,
Task authorization, implementation, merge or Readiness is established here.

## 19. Task-planning inputs

Recommended ordering for the later Task Planning activity:

1. Define persisted IAM grant, generation, pending consent and protocol
   artifact contracts. Establish the transaction/fence rules and migrate the
   recovery, cancellation and erasure writers. Verify mixed-writer races
   before exposing delegated admission.
2. Update and verify the actual API's Fastify dependency. Fit the tested
   Fastify bridge to the real host, session resolver and
   transaction-bound adapter. Carry the failure, replay, deadline, cookie,
   endpoint/TTL and key-rotation cases into API integration.
3. Implement the synchronous affected-set/outbox operation and the established
   audit, notification, export and erasure projections. Exercise retries,
   grouped facts, parameter limits and realistic competing traffic.
4. Add candidate-bound isolated-suite coverage to CI and require the external
   SonarCloud result. Validate the production runtime profile and confirm the
   downstream client handoff with #214.

These boundaries are recommendations for planning. Work #215 is Preparing.

Work #214 consumes the resulting approved and validated authorization
capability. No MCP product implementation belongs to #215.
