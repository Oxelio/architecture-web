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
Work #215 includes the OAuth authorization server integration. The proposed
structural rationale is in
[ADR-0012](../architecture/decisions/0012-oauth-authorization-server-integration-and-grant-authority.md).

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

IAM is the unique business authorization authority. It owns client admission,
permission policy, consent, grant lifecycles and final delegated admission.
The OAuth protocol adapter owns codes, tokens, interactions and provider Grant
references. Each provider Grant is bound to one IAM grant lifecycle and resource.
The presence of provider state alone cannot authorize an operation.

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

Prefer an embedded `oidc-provider` protocol adapter composed in the
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
accounts before real user exposure. The isolated protocol results appear in
[executable feasibility evidence](#executable-feasibility-evidence).

## 16. Provider feasibility

The [proposed ADR](../architecture/decisions/0012-oauth-authorization-server-integration-and-grant-authority.md)
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

### Remaining integration boundaries

The experiment established race ordering on a single PostgreSQL primary under
a fixture-wide transaction lock. Production lock order, deadlocks, fan-out
and read replicas require separate evidence. The resource endpoint is a mock.
Issuer restart used the same database and keys.
Database failover, ambiguous commits, backup/restore, key rotation, and
production TTL/purge policies require separate evidence. Erasure covers the
fixture's linked rows and outputs. Production Audit, Notifications, export,
backup retention and the erasure witness remain with their existing owners.

The fixture starts from synthetic first-party sessions and static public OAuth
clients, with one resource and two permissions. Integration remains open for
Fastify/Web session wiring, cross-account provider session switching,
production CSRF/TLS controls and endpoint choices such as authenticated resource-server
introspection, DCR/CIMD, RP-initiated logout and RFC 7009 revocation. Decide
the exposed protocol endpoint profile and error mapping for rejected redirects
and write-only renewal after withdrawal. Test #214 client interoperability
against that profile. Full SF acceptance remains a separate validation
activity. Production transaction integration for every FR-11 event remains open.

## 17. Proposed architecture decision

[ADR-0012 — OAuth Authorization Server Integration and Grant Authority](../architecture/decisions/0012-oauth-authorization-server-integration-and-grant-authority.md)
records the proposed structural decision and the current-state owners to
synchronize when an accepted target becomes effective.

## 18. Risks and unresolved technical decisions

Blocking design work remains in the
[integration boundaries](#remaining-integration-boundaries). Verify the
Fastify response boundary, production lock ordering, lineage storage and
recovery, exact hosting runtime, endpoint interoperability, and integration
with account security and erasure.
Confirm protocol/user experience can preserve the approved functional target.
If not, escalate to Functional Specification authority before any deviation.

The candidate remains proposed and awaits the applicable structural decision.

## 19. Task-planning inputs

After technical decisions and structural acceptance where triggered, plan
focused execution units around authoritative grant state and transactions,
security transition integration, protocol adapter, administration/consent/
connected application UI, audit/notifications/export/erasure, and integrated
validation. Sequence against approved contracts and consistency guarantees.
These are candidate implementation boundaries, not authorized Tasks.

Work #214 consumes the resulting approved and validated authorization
capability. No MCP product implementation belongs to #215.
