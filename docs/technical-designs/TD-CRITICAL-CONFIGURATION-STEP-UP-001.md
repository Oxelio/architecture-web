# Technical Design — Operation-bound critical configuration confirmation

> **Identifier:** TD-CRITICAL-CONFIGURATION-STEP-UP-001
>
> **Artifact status:** Prepared for implementation
>
> **Content status:** Proposed Target (Work #184; not effective Current Truth)
>
> **Document type:** Technical Design
>
> **Domain:** IAM / Security Configuration

## Work context

[Work #184](https://github.com/Oxelio/architecture-web/issues/184),
Product Behavior Change / Complex / security, concurrency and migration.
The [approved SF-SECURITY-CONFIG-001](../specifications/SF-SECURITY-CONFIG-001.md)
owns behavior; [human approval](https://github.com/Oxelio/architecture-web/pull/209#issuecomment-7190874821)
covers F1–F5. Preserve [MFA](../specifications/SF-MFA-001.md),
[session](../specifications/SF-SESSION-001.md) and
[audit](../specifications/SF-SECURITY-AUDIT-001.md) invariants.
Architecture owners: [IAM security](../architecture/iam-security.md),
[dependency rules](../architecture/dependency-rules.md),
[packages](../architecture/packages.md) and [testing](../development/testing.md).
Current code evidence is based on main
`44f50f18041b7d1c91d499e13925ed8a70b08819`; integrate this base into the
Work branch before implementation. [Work #210](https://github.com/Oxelio/architecture-web/issues/210)
is integrated and completed.

## 1. Scope, ownership and alternatives

Keep the existing publication and restoration HTTP requests, including their
explicit confirmation, password, optional MFA code, expected version and
justification. Use a request-local proof, not a separately issued grant,
new endpoint, token, cookie or session. Restoration resolves its immutable
target revision and delegates once to the same publication orchestration.
The proof is not returned, persisted, or usable by other requests or operations.
Do not refresh session creation, expiry or a global recent-authentication
timestamp. Other consumers of Reauthentication.recent/strong are unchanged.

A general session freshness timestamp would authorize unrelated operations.
A separately issued grant would require atomic redemption, replay storage,
expiry, operation canonicalization and revocation across requests without a
second interaction being required. A request-local attempt meets the approved
one-attempt behavior with less surface area. Redis remains the session owner;
PostgreSQL remains the authoritative account, credential and configuration
store. No generic step-up framework or cross-context model is required.

## 2. Application flow

At server request ingress capture a trusted same-process monotonic start time
before asynchronous authentication, body parsing or restoration lookup. Pass
that execution timing internally, never accept it from the client. For direct
application invocations start at entry; restoration propagates the original
start unchanged. The two-minute elapsed deadline is exclusive. The absolute
session expiry remains checked separately. Use controllable time in tests.

Authorize the actor, validate input, normalize justification once, resolve
restoration values, capture the published revision and compute critical changes
server-side. Reject a known stale expected revision before verification.
Preserve non-critical publication behavior and transaction guards. For critical
changes require the explicit confirmation and a valid originating session
belonging to the active administrator, with matching account generation.
Use the captured current authentication policy, not the proposed policy.
Validate presence/representation of required credential input and refuse
mandatory MFA without enrollment before credential verification. No admission
for input rejected without attempting credential verification.

Reserve one account attempt atomically before checking credentials. Bind the
attempt to an immutable local command (actor, originating session, operation
kind, restoration source if any, normalized values and reason, expected
version, captured policy and timing). Do not trust client-derived criticality.
Capture current account security state coherently at admission. Verify current
password using existing password rules for authentication (not creation policy).
If the captured account has enabled MFA, reuse FactorVerification and MfaStore
atomic TOTP/recovery-code consumption. Do not verify an optional code when MFA
is not enabled; do not bypass enrollment when required. Map factor failure to
a generic confirmation refusal, not a replay-specific result. Each admitted
attempt is consumed irrespective of proof or later operation outcome. No
automatic credential or publication retries.

After proof succeeds, perform the final authorization guard below. Only then
invoke ConfigurationStore.publish once with the same immutable command and
verified account session generation. Preserve existing optimistic revision,
active administrator, session-version and last-access checks, atomic revision
and outbox, restoration origin and audit behavior. A final guard denial
creates no revision. A conflict after factor consumption needs a new
confirmation, and never restores a consumed factor.

## 3. Account security state and final authorization

Current password changes use the IAM Unit of Work, recovery uses its
transactional token operation, and both invalidate the session generation.
MFA activation/disable update the generation; backup-code regeneration does
not. MfaStore.verify already locks the account, checks the sealed secret and
consumes factors atomically. Do not use a session-generation-only proof for
MFA changes. Do not compare last TOTP counter or consumed-code flags as
security-state versions: legitimate factor consumption changes them.

Introduce a narrow application-owned critical-configuration security-state
and attempt-admission capability. Capture an immutable, opaque comparison
snapshot of active/admin state, session generation, current non-revoked
password authenticator identity and hash identity, and MFA enrollment/secret
identity and sorted backup-code row identities (including consumed rows).
The adapter may compare an unambiguous internal fingerprint rather than
exporting hashes or sealed secrets; no secrets or bearer IDs in persisted
attempts or diagnostics. Regeneration replaces backup-code IDs; factor
consumption leaves the set intact. Capture and compare under the existing
authoritative account/administrative-access locking discipline. Reuse
password verification and factor consumption rather than duplicate them.

For final authorization, a short PostgreSQL guard transaction acquires the
existing administrative-access fence then locks the actor row in the existing
order. Re-read and compare the captured security state; require active admin
and same generation, non-revoked credential and unchanged relevant MFA state.
While this guard protects the account state, perform a fresh read-only
SessionRepository.findById of the originating session. Check owner, generation,
session expiry and original elapsed attempt deadline after the read; a missing
or invalid session is authentication refusal. The accepted Redis read is the
session-validity linearization point (conservative expiry check afterward).
A revocation before the read is rejected; after the read, an admitted operation
may finish subject to independent publication checks. The guard must complete
successfully before returning admission to publication. Never update session
activity from this guard.

The application owns final authorization and may supply a scoped read-only
session-check callback to a transaction-owning application port. The SQL
adapter owns transaction/lock/state mechanics and must not depend on a
concrete Redis adapter or application use case. No SQL transaction spans
password hashing or MFA consumption, and no cross-resource write transaction
is attempted. Bound the Redis check by the remaining attempt deadline and
a short technical timeout (initial maximum two seconds); timeout or storage
failure is a technical exception, rolls back/releases locks, and cannot
permit late admission. The callback is read-only, cannot publish, and a late
read result is ignored. The Developer must verify all account-security mutation
paths use compatible locks; if an uncovered writer or a lock-order conflict
is found, stop and return to Software Architect rather than weakening the
guard. Test lock order and timeout release with real stores.

After final authorization the existing publication transaction independently
checks account generation, authorization, revision and last-access invariants.
Keep the transactions separate so factor consumption remains committed even
if the subsequent configuration transaction fails. Do not weaken existing
post-authorization rejection behavior.

## 4. Shared rolling allowance

Use PostgreSQL for the narrow account-scoped admission ledger, rather than
process memory, Audit projection or a Redis counter that can silently reset on
cache loss. This is authoritative security accounting, independent of
configuration publication and event delivery. Use an additive forward IAM
migration and a bounded per-account record (at most five admitted timestamps),
with account FK and deletion cascade. The adapter serializes admissions using
the existing account lock order, verifies current authorization and known
revision before reserving, obtains database time after acquiring locks, and
prunes timestamps at or before now minus five minutes. If five remain, refuse
without appending or extending the window. Otherwise append one timestamp
and commit before password/factor verification. Concurrent instances share
the same transaction boundary. An uncertain commit may consume allowance;
never retry automatically. Technical failure fails closed. Successful proof,
other sessions or restoration do not reset it. No password/factor values,
session identifiers or operation contents are stored. Old timestamps are
logically expired and pruned at next admission; storage is bounded and
deleted with the account. No historical attempt backfill is required.

The exact table representation and port names are local Developer choices.
Keep public application contracts explicit; update composition, affected
test doubles, migration registration and persistence schema together.
Do not add a generic rate-limiting framework or change recovery/sign-in limits.

## 5. HTTP and Web

Preserve current routes/body compatibility; internal execution timing and
new scoped application result cases are not client-supplied credentials.
Distinguish invalid/missing session (authentication required), refused proof
(including required MFA not enrolled, invalid factor or expired attempt),
attempt allowance exhausted (429), revision conflict (409), unauthorized
administrator and technical failure (existing technical error handling).
Use stable typed application errors and existing presenter/envelope patterns;
do not expose factor replay reason, credential state details or SQL/Redis
errors. Keep existing unrelated authentication mappings unchanged. A proof
refusal must not trigger a global logout; a genuinely invalid session follows
existing authentication behavior. Update HTTP reference and localized FR/EN
feedback and the recent-authentication setting description.

The Web captures an explicit exact operation and expected revision before
confirmation (including restoration target), uses the existing diff/preview
and reason, invalidates confirmation if intended data changes, prevents
duplicate/cross publication/restoration submission, disables incompatible
edits while pending, and clears password/factor fields on every settled
attempt, not only success. Preserve draft and reason on refusal or conflict;
show reconciliation and retry instructions rather than automatically
resubmitting/replaying credentials or silently advancing the expected version.
Accessible feedback and keyboard flow must be tested.

## 6. Security, operations, migration and compatibility

Keep credential strings, bearer session IDs, opaque security-state comparison
material and raw requests out of logs, exceptions, audit and events. Existing
attempt auditing and outbox acceptance/failure policy apply; admission does
not depend on Audit. Preserve existing restoration and publication traceability.
No new cross-context events required. Review secret redaction at HTTP,
application and audit boundaries.

Additive IAM migration, fresh and upgraded schema validation, account erasure
cascade and bounded storage. No credential/session/configuration rewrite or
backfill. New application instances require the migration; coordinate rollout
so old writers do not bypass the new shared allowance or proof rules. Mixed
old/new instances are not a supported final behavior: drain old critical
operation handlers before enabling the new version. Rollback to old code
would restore the previous behavior, not be security-equivalent; retain
migration data and use forward recovery. Existing session and HTTP request
formats remain usable. Update current architecture/HTTP/guide owners for
the effective change in the integration PR, not in advance of implementation.

Normal requests add a short admission transaction and final guard; only
critical operations pay this cost. The guard may contend with administrative
mutations; use bounded read time and verify lock release and no deadlocks.
Do not add distributed transactions or indefinitely hold a lock on network IO.

## 7. Validation strategy

Map to SF-SECURITY-CONFIG-001 scenarios 21–28 plus affected existing cases.
Application tests: old valid session, no session reset, mandatory/enabled MFA
including recovery code and denial, stale version before admission, input and
authorization rejection, exact deadline/session expiry, same attempt not
reused, captured policy vs replacement, technical exceptions, restoration
delegation and unchanged non-critical/recent-auth consumers.
Real PostgreSQL/Redis integration: two independent connections/instances,
five successful/failed/concurrent admissions across sessions and operations,
sixth refused, exact rolling boundary, no reset, storage outage, migration
and erasure; deterministic barriers for session revocation/expiry, password
replacement, MFA activation/disable/backup-code regeneration, actor role/status,
revision race on both sides of final authorization, consumed factors on conflict,
publication transaction safeguards and rollback/outbox. Verify actual scheduled
expiry and final guard timeout releases locks. Use real factor consumption;
no mock-only concurrency proof. HTTP contract tests for mappings, ingress
timing and redaction; Web tests for exact target, disabled duplicate submission,
draft preservation, cleared secrets, accessible localized feedback and no
automatic retry. Run full repository CI with real integration endpoints,
migration verification, docs links and existing required checks. Reviews:
Code, Architecture, Functional Compliance, Security and migration/operations.

## 8. ADR assessment and execution

This is a bounded implementation design within existing IAM/Redis/PostgreSQL
ownership, not a new durable architectural rule. No ADR trigger identified;
if the implementation requires a new cross-resource consistency architecture
or changed public port semantics beyond this scope, escalate. No new Functional
Approval is implied or required for technical choices preserving the approved
behavior.

One coordinated Work Integration PR and one Codex execution unit are selected.
The local implementation order is admission/state guard and migration,
application orchestration, HTTP and Web integration, then cross-boundary
verification and documentation synchronization. These are coupled local
steps, not separately delegated or independently integrated Tasks. If separate
execution units become necessary, return to Task Planning before delegation.
