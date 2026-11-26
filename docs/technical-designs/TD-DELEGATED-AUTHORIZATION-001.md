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

Design baseline: focused reads of current main and the Work branch; executable
feasibility evidence has not been obtained. The proposal remains incomplete
pending the protocol integration experiment and structural decision.

## 1. Authorized behavior / constraints to preserve

Use the approved SF, not protocol defaults, to decide grants, permissions,
security invalidation, consent, admission boundaries, notifications and export.
Preserve existing account, MFA, session, audit and deletion owners. No delegated
administrative access. No raw browser session credential crosses the delegated
boundary. MCP adapters, tools, UI and distribution belong to #214.

## 2. Bounded-context / responsibility ownership

Propose a fourth IAM application capability, delegatedAuthorization, alongside
accounts, authentication and administration. Existing administration remains
responsible for administrator eligibility; delegatedAuthorization owns the
client policy and grant lifecycle. No independent bounded context or shared
cross-context domain model is justified by current requirements.

OAuth is a protocol adapter, not a product domain. IAM owns client admission,
permission policy and active grant decisions. A provider may maintain protocol
records (codes, tokens, interactions, provider grant references), but these
are subordinate to the authoritative IAM grant and never confer access alone.

Notifications and Audit consume integration facts under existing ADR-0005.
The composition root wires public contracts and concrete adapters.

## 3. Domain responsibilities and consistency boundaries

Candidate separate aggregate roots:

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
Application contract names and signatures remain to be finalized.

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

Preferred initial topology: protocol adapter composed alongside the existing
Fastify host, logically separated from HTTP account controllers. Existing
Web handles first-party login, consent, connected applications and admin
screens. No additional worker lifecycle or identity store.

Evaluate node-oidc-provider first; provider-specific handlers, storage
serialization and metadata mapping stay in infrastructure. The protocol
server is not the MCP resource server. Future #214 uses IAM admission through
an explicit application-owned contract at a trusted resource boundary.

Separate process topology is a valid alternative, not yet decided. No direct
imports from one application's private composition root into another.

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
expiry and granted permission snapshot. A permission removed then regranted
must not become usable through an older credential. Compare permission
generations or rotate the grant credential revision on restriction; if
rotating, renewal must not silently restore withdrawn privileges. This
representation and unaffected-scope renewal behavior need proof in the spike.

## 8. Flows, interfaces and contracts

Authorization Code with PKCE S256 is the initial protocol candidate. Use
pre-registered approved clients initially where interoperability allows.
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

## 9. Transactions, consistency, concurrency and idempotency

Authoritative grant decisions and security mutations must be serialized in
PostgreSQL. Use existing account locks/administrative-access discipline as the
starting point; define and test a consistent lock order for account, client and
grant boundaries before implementation. Do not acquire account locks after
client locks if other paths acquire them in reverse order. Provider/network
I/O must not be performed while holding unbounded database locks.

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

## 10. Messaging / cross-context integration

Record durable integration facts for actual authorization and permission
transitions and client administration. The producer supplies stable event
identity, actor/subject references and logical operation identity; never
secrets or bearer identifiers. Produce one logically grouped revocation fact
per affected user and operation, or a durable equivalent that proves the
grouping and replay invariant. Audit may preserve more granular attributable
evidence under its own policy.

Notifications owns channels, recipients and delivery eligibility. Do not
select email destinations in IAM or add a separate notification subsystem.
Extend existing cross-context projections, export and erasure routes without
sharing domain models. Apply account-erasure handling to delayed/replayed facts.

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
client. Set operational token/interaction lifetime, throttling, and storage
limits after compatibility and security evidence; do not invent approved
business limits. Fail closed on unavailable authorization decisions.

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
accounts before real user exposure. No test execution or successful
interoperability is asserted here.

## 16. Technical alternatives and trade-offs

- node-oidc-provider: first candidate. Official documentation advertises
  Node/Fastify integration, resource indicators and CIMD draft support.
  Validate the selected release, adapter and extension points; ensure all
  issuance, refresh and admission paths respect IAM and do not duplicate
  authoritative grant state.
- Ory Hydra: independent protocol server with external login/consent.
  The official OSS MCP guide uses v26.2.0 without resource indicators; the
  enterprise guide documents support. Verify actual selected OSS release and
  license before treating it as equivalent. Separate persistence and remote
  lifecycle coordination increase consistency complexity.
- Keycloak/external identity platform: candidate only if it can preserve
  existing IAM ownership without identity duplication or unjustified
  replacement. Not preferred given current scope.
- Custom protocol implementation: reject as the initial direction; protocol
  primitives and maintenance risk have no identified product value.

References:
[node-oidc-provider](https://github.com/panva/node-oidc-provider),
[Hydra OSS MCP guide](https://www.ory.com/docs/guides/mcp/hydra-oauth-oss),
[Hydra OEL MCP guide](https://www.ory.com/docs/guides/mcp/hydra-oauth-oel),
[MCP authorization](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/index.mdx),
[OpenAI authentication](https://developers.openai.com/plugins/build/auth).
Documentation evidence only, consulted 2026-11-26.


### Version-pinned feasibility findings (static inspection)

Candidate: oidc-provider 9.15.1 (MIT; release 2026-11-20). Reviewed the
tagged source, not only main or generic feature documentation. The package
is ESM JavaScript; confirm TypeScript declarations and the project's Node
runtime compatibility in the isolated experiment. Do not add a runtime
dependency before the structural decision.

| Boundary | Observed source capability | Required project-specific proof |
| --- | --- | --- |
| Consent | Custom interactions, findAccount, loadExistingGrant; provider Grant has per-resource accepted/rejected scopes. | Mandatory/optional classification, final consent check, account binding, no stale remembered consent, repeated optional-scope request. |
| Client admission | Client adapter lookup; CIMD allowFetch and allowClient (including cached metadata). | Reject unknown/disabled clients at all relevant endpoints, even cached; no metadata-based self-approval. |
| Resource | resourceIndicators.getResourceServerInfo, defaultResource, useGrantedResource; PKCE policy. | Single intended resource, enforce S256 and scope policy, no cross-resource credential reuse. |
| Issuance | Authorization-code and refresh handlers load provider Grant and validate account. | Every code/refresh issue and persistence path subordinate to current IAM authorization; concurrent invalidation cannot return a usable credential. |
| Storage | Adapter contract includes upsert, find, consume, destroy, revokeByGrantId and lookup methods. | Atomic consume rejects reuse by throwing, not returning false; hashed bearer lookup keys where compatible; expiry, erasure, replica/race behavior. |
| Introspection | Valid token and provider grant checks plus allowedPolicy; opaque token format supports extra claims. | Authenticated resource-server caller, safe projection, current IAM admission with precise lifecycle/resource/scope binding. |
| Session | Default expiresWithSession and initial refresh issuance depend on offline_access. | First-party sign-out preserves business grant and valid delegated credentials; consent still requires live first-party session. |

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

### Grant authority and credential epochs

The provider Grant can contain scopes for several resources and the default
loadExistingGrant may reuse a grant referenced by its own session. Neither
matches the IAM invariant automatically. Candidate mapping: explicit provider
grant/credential-family reference to a single IAM authorization lifecycle and
resource; no provider grant spanning several IAM authorization lifecycles.
Provider consent and cached client metadata are not product authorization
decisions. Use custom interactions and authoritative lookups, disable
development interactions and unneeded flows/endpoints, and prove that
automatic consent reuse cannot bypass FR-15.

The provider's refresh handler checks requested scopes against the old refresh
token and builds a rotated token carrying the original refresh scope. Current
provider-grant scope filtering does not by itself prove that a removed and
regranted permission cannot reappear through an old credential. A revision
claim on an access token alone is insufficient: extraTokenClaims in the opaque
format applies to access tokens and client credentials, not refresh tokens.

Prefer an immutable issuance entitlement snapshot bound to credential-family
or token lineage, including the IAM grant lifecycle, resource and permission
generations. A refresh derives only the intersection of its original
entitlements with the still-current generations and policy; it must never
acquire a regranted generation from the current grant. Renewals for unaffected
permissions should remain possible when supported. Compare a simpler
whole-family invalidation on scope withdrawal; it may force reconnection and
must be reviewed for functional/UX implications rather than silently selected.
Use explicit non-reused grant identity after complete revocation.

The provider's grant validation verifies existence, expiry and client match;
it is not sufficient for current IAM grant/account/policy checks. findAccount
is invoked on code/refresh issuance but cannot alone serialize against a
concurrent invalidation. Evaluate supported hooks plus a guarded storage
boundary for code/token persistence and renewal; final resource admission
must check the authoritative state regardless of provider cleanup timing.
Do not patch undocumented internals or infer a cross-call transaction from
adapter method calls. Opaque bearer values are used as provider lookup keys
by default; assess keyed hashing of storage identifiers and safe indexing
without persisting raw tokens in logs, export or audit.

Provider revocation and replay protection can destroy protocol grants or
credential families. Distinguish credential/family invalidation from explicit
IAM business grant revocation. Define mapping and reconcile security events;
provider events are not the synchronous enforcement boundary. Test provider
session expiry/logout independently from first-party session logout. The
provider defaults tying expiry and initial refresh issuance to offline_access
must be deliberately configured and verified, not assumed compatible.

### Bounded executable feasibility experiment

Use an isolated disposable workspace with exact oidc-provider 9.15.1,
synthetic account/client/resource data, a minimal protocol host and a
PostgreSQL-backed adapter experiment. Keep product dependency manifests,
runtime and approved behavior unchanged. Record Node/pnpm versions, dependency
lock, commands, expected and observed outcomes. Use direct OAuth requests or
an OAuth client harness, plus a mocked resource-server admission boundary
using the same authoritative data; do not require real account data or
ChatGPT credentials.

| Case | Required evidence |
| --- | --- |
| F01 | Custom first-party login/consent binds actual authenticated account; read accepted, optional write declined; returned scopes and admission match. |
| F02 | Code exchange requires correct S256 verifier, client and redirect URI; concurrent redemption admits at most one exchange. |
| F03 | Reject unapproved/disabled client, wrong resource, unknown/disallowed scopes; cached client cannot bypass disablement. |
| F04 | Declined extension leaves existing grant unchanged; new consent can extend it; stale consent after revocation cannot recreate access. |
| F05 | Revoke after authorization code issue, before exchange; old code/refresh and access admission fail after effective invalidation. |
| F06 | Remove write then regrant it; old access and refresh lineage cannot recover write; test unaffected read continuity and new consent. |
| F07 | Concurrent refresh/revocation and refresh replay, including two processes; no usable credential issued from invalidated lifecycle. |
| F08 | Re-enable client or reactivate account; old credentials remain unusable; new authorization has distinct identity. |
| F09 | Sign out or expire first-party session; independently valid grant/credentials continue; stale pending consent fails. |
| F10 | Storage failure, restart, expiry/erasure and guarded persistence; fail closed, no raw credentials in outputs. |

Gate recommendation: if F01-F10 demonstrate required protocol and authority
boundaries using supported hooks, prefer embedded provider subject to
structural acceptance; otherwise evaluate independent authorization server
or a narrower supported integration, escalating any required functional
deviation. Static inspection alone is not a pass. No executable cases have
been run in this activity; no proof of full compatibility is claimed.

## 17. ADR candidates / referenced ADRs

One structural decision candidate: protocol server integration and
authoritative delegated authorization boundary. Consider embedded provider
versus independently deployed provider; preserve existing aggregate and
messaging decisions. Draft an ADR after feasibility evidence supports the
alternatives and rationale. No structural acceptance has been granted.

## 18. Risks and unresolved technical decisions

Blocking design work: validate the pinned 9.15.1 candidate in an executable
experiment, verify extension points, controlled client identity, mandatory/optional partial consent,
resource/audience binding, refresh and revocation consistency, opaque
credential support and persistence/erasure. Resolve lock order and fan-out,
credential permission generations, lifecycle binding and failure recovery.
Confirm protocol/user experience can preserve the approved functional target.
If not, escalate to Functional Specification authority before any deviation.

Do not declare Readiness or start product implementation based on this
candidate. A feasibility experiment requires an authorized bounded scope.

## 19. Task-planning inputs

After technical decisions and structural acceptance where triggered, plan
focused execution units around authoritative grant state and transactions,
security transition integration, protocol adapter, administration/consent/
connected application UI, audit/notifications/export/erasure, and integrated
validation. Sequence against approved contracts and consistency guarantees.
These are candidate implementation boundaries, not authorized Tasks.

Work #214 consumes the resulting approved and validated authorization
capability. No MCP product implementation belongs to #215.
