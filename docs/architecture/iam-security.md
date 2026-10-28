# IAM security responsibilities and consistency

## Application responsibilities

`packages/contexts/iam/src/application/create-iam.ts` builds the original account, session and administrator contracts. `create-iam-security.ts` builds configuration, recovery, MFA, account-data and maintenance contracts. These factories only compose use cases; they contain no workflow or runtime dependency lookup.

| Responsibility                                                   | Owner                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Password requirements and profile selection                      | `src/domain/password-policy.ts`                               |
| External password validation coordination                        | `accounts/password-policy/PasswordValidation`                 |
| Fixed or published policy consumption                            | Capability reader contracts and `PublishedIamPolicies`        |
| Configuration consultation, preview, publication and restoration | `access-administration/security-configuration`                |
| Recovery request and password reset                              | `accounts/recovery`                                           |
| Enrollment, challenges, factors and reauthentication             | `authentication/mfa` and `authentication/reauthentication.ts` |
| Session creation shared by direct and MFA sign-in                | `authentication/issue-session.ts`                             |
| Export, deletion and IAM maintenance                             | `accounts/account-data`                                       |
| SQL queries and atomic persistence                               | `packages/adapters/iam/persistence-kysely`                    |
| Encryption, tokens, QR, ZIP and cross-context integration        | `apps/api/src/adapters/iam`                                   |
| HTTP schemas, controllers and presenters                         | `apps/api/src/features/iam`                                   |

Application result contracts represent expected refusals. Unexpected database, crypto, checker, cache and delivery failures remain technical exceptions. HTTP status belongs to presenters. Configuration consumption cannot publish revisions.

## Password operations

The standard profile is used by sign-up and public evaluation. Changes and recovery select the profile from the persisted account role. One immutable policy is read and explicitly passed to validation, including the reuse decision. `PasswordValidation` neither selects a profile nor reloads configuration.

Authenticated changes verify the existing password before checking the replacement. Recovery first verifies the single-use token. Both use the same pure rules and external-check contracts, but recovery does not authenticate a session or disable MFA. Both reject the current password when configured.

PostgreSQL replacement locks the account and rechecks authoritative role and authenticator state. Recovery also locks and rechecks its token. The token is consumed before the authenticator update so invalidation triggers do not invalidate the token being successfully consumed. Concurrent uses cannot both commit. A transaction failure rolls back both mutation and outbox append.

## Configuration publication

Startup explicitly initializes the first revision only when no configuration history exists. Existing history without a published revision fails explicitly. Subsequent reads use the complete published PostgreSQL snapshot. There is no process-local cache or environment fallback. Invalid persisted configuration raises a technical failure.

Publication takes a transaction-scoped advisory lock, rechecks the expected version, supersedes the current revision and inserts the complete replacement with its outbox event. A partial unique index prevents two published revisions. The same lock serializes first initialization. Existing duplicates cause migration failure rather than being deleted silently.

Preview evaluates one snapshot and returns its own before/after values. Set-valued changes are reported at their catalog key so critical-change confirmation cannot be bypassed through array indices. Restoration validates old values and creates a new revision. Critical publication and restoration require explicit confirmation, a recent authenticated session, the current password and an enabled MFA factor. The account session generation from this proof is checked again during publication. Restoration takes the viewed expected version and a supplied reason; it does not synthesize confirmation.

## MFA and account data

MFA persistence locks the account before credential and challenge rows. Enrollment cannot replace an enabled factor. Confirmation checks the pending secret and increasing TOTP counter. Activation consumes a matching enrollment confirmation and invalidates sessions. Verification reserves attempts, consumes a factor and consumes its sign-in challenge in one transaction. Invalid attempts commit their counter; exhausted challenges are reused until expiry rather than reset by another password submission.

Export reservations serialize per account. Archive data uses explicit projections and excludes bearer session identifiers as well as password hashes, usable tokens and MFA secrets. Download takes and clears the binary atomically. Generation failure records `failed` and propagates the original technical exception.

Deletion requests serialize the last-administrator check, enter the domain's pending-deletion state, invalidate tokens and increment the session version. Cancellation rechecks expiry and consumption inside its transaction and restores the previous status without restoring sessions. Final deletion rechecks due state and legal hold under lock. Audit pseudonymization is an explicit cross-context call and can precede a PostgreSQL commit that later fails; retries must remain idempotent. IAM does not claim atomicity across context applications or external providers.

## Events and partial failures

Committed PostgreSQL security mutations append secret-free integration events to their transaction's outbox. Audit subscribes to these events and resolves retention through an injected application contract; Notifications uses its own policies and recipient directory. Recovery requests and transport-denial auditing use the explicit Audit integration adapter.

Session-started integration facts use version 2 and carry the account identifier rather than the bearer session identifier. Audit also redacts credential metadata on disclosure, so an export cannot reveal credentials from previously stored entries. Session-management contracts retain their existing identifiers; separating public management references from authentication credentials remains a distinct security change outside this refactoring.

Redis cleanup and messages containing plain verification, recovery or cancellation tokens remain post-commit. Their failure does not roll back committed PostgreSQL state. A stale session remains unusable through status/version checks even if Redis cleanup fails. Plain tokens are never put into the generic outbox. No distributed transaction or new encrypted message-delivery system is introduced.

## Operation and concurrency boundaries

Each use-case execution captures one published revision. Registration projects account and password rules together; sign-in projects account, MFA and session rules together. Nested calls receive those parameters instead of rereading configuration. Account export/deletion and MFA management similarly pass captured authentication rules to reauthentication. A later MFA-confirmation request is a new execution. Publication does not change rules already captured by an operation; account status, credential replacement and session-generation checks still use authoritative state.

Successful password use is a conditional metadata-only update: it matches the verified authenticator and hash and requires a non-revoked row. It never saves the detached credential. A concurrent replacement or revocation rejects the sign-in; a later account-version change cannot be converted into a new valid session by reloading its version. MFA challenges persist the password proof's session generation and check it when created and consumed.

Recovery issuance locks the account and revalidates the exact verified email identity before inserting a token. Identity replacement uses the same account lock. Tokens store identity ID and generation; reset checks that binding under the account lock. Database triggers increase identity generation on address/verification changes and invalidate existing tokens. Verification resend also rechecks the identity under the account lock before issuing a new verification token.

The administrative-access advisory lock (`728194002`) precedes configuration lock (`728194001`), account locks and subordinate records in participating workflows. Publication/restoration check the persisted actor and require a usable active administrator with an allowed identity, non-revoked authenticator and required MFA. Deletion, suspension and role removal share this serialization; actor authorization is rechecked inside administrative mutations. Identity replacement cannot remove the final usable path. MFA deactivation rechecks current required-role policy under the same guard. No enrollment grace or exception is introduced.

## Persisted representations and history

Migration 007 adds identity generations and proof bindings. Existing recovery fingerprints cannot prove which identity generation issued them; unconsumed unbound recovery rows and old sign-in challenges are retained but invalidated. Users may request a new link or sign in again. Password hashes, MFA settings and account state are retained.

Migration 008 labels existing configuration representations as version 1 without rewriting their JSON. The explicit v1 decoder supplies the historical missing-identifier meaning (`email` only) and converts duplicate set members into a canonical set. New publications use version 2 and strict complete-snapshot validation. Unknown keys, unsupported versions and corrupt values fail explicitly; no read merges deployment values. Restoring v1 creates a new validated v2 revision, preserving the original.

New revisions persist actor, dates, reason, origin, restoration source and non-sensitive comparisons. Unrecorded historical metadata stays null. Administrative consultation reads values and history in one repeatable-read transaction and exposes stored statuses rather than guessing the published revision from list order. Attempts are recorded separately from the transactionally persisted successful publication event.

## Reviewed corrections and remaining acceptance

| Review finding                             | Origin                                                      | Correction / evidence boundary                                                                           |
| ------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Detached sign-in save restores credentials | Inherited                                                   | Conditional metadata update; PostgreSQL interleavings with change/reset/revocation, with and without MFA |
| Recovery insertion after email replacement | Inherited                                                   | Shared account protocol and checked identity generation; both orderings tested                           |
| Final administrative access not enforced   | Inherited                                                   | Commit-time predicate, restoration path and mixed mutation races                                         |
| Legacy configuration rejected              | Introduced                                                  | Explicit versioned decoder; real pre-refactor-schema upgrade and restoration                             |
| Hybrid operation policies                  | Inherited split sources; introduced dynamic revision mixing | Workflow-scoped projections; publication forced inside registration and sign-in                          |
| HTTP code and MFA cookie regressions       | Introduced                                                  | Transport aliases, schema-error mapping and success-only cookie clearing                                 |
| Critical confirmation/history incomplete   | Inherited                                                   | Fresh proof, actor-generation check, immutable metadata and attempt records                              |
| ADR-0007 marked superseded                 | Introduced                                                  | Existing acceptance restored; grouped implementation documented as divergence                            |

Code Review, Architecture Review, Functional Compliance Review, security/compatibility review and Validation remain distinct assessments. Automated evidence does not establish human acceptance or Done. The configuration specification is not declared complete: fleet-wide acknowledgement telemetry, the strengthened operator recovery procedure, exhaustive notification delivery and accessibility acceptance still need their respective evidence/decisions. The functional owner must specify the operator recovery authority/proof and material-reduction notification selection before implementing a new bypass or recipient policy. Database reads have no process-local cache; this is not a claim of per-instance deployment acknowledgement.

## Correction review and validation record

These are agent review conclusions for the correction, not human acceptance:

| Perspective                  | Conclusion                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code Review                  | Focused persistence operations replace detached authentication saves; expected refusals remain explicit results. Adapter doubles and all workspace consumers have been migrated. No remaining blocking implementation finding was identified in this scope.                                                                                                                                                       |
| Architecture Review          | Domain/application remain independent of Kysely, Fastify and runtime adapters. Aggregate boundaries, manual composition and secret-free integration contracts are preserved. The inherited grouped-topology divergence from accepted ADR-0007 remains explicit; this correction does not approve a successor.                                                                                                     |
| Functional Compliance Review | The reviewed sign-in, recovery, administrative access, configuration and HTTP regressions are corrected against their owners and the three explicit maintainer decisions. This does not close every acceptance criterion of SF-SECURITY-CONFIG-001.                                                                                                                                                               |
| Security and compatibility   | Checked proof generations and commit-time guards have real PostgreSQL/Redis interleaving evidence. Legacy configuration JSON/settings/history are preserved; unprovable historical authentication proofs are invalidated. Source-contract and restoration-request migrations are documented. No destructive data cleanup or new authentication recovery exception is included.                                    |
| Validation                   | Workspace build, normal/test typechecks, lint, tests, formatting, Markdown links/checker tests and whitespace checks were executed. The dedicated PostgreSQL/Redis run executes 32 integration scenarios plus 21 security HTTP scenarios. Ordinary workspace tests skip those opt-in database scenarios; the dedicated run is the database evidence. Human candidate-bound pre-merge validation remains required. |

The reviewed starting candidate was `fcae424bc2684750877b248afc48c73195602fb6`, against `4436adfbae72aacdfc8a4ff6cb49f1dec2dbca41`, with Method gitlink `703051af50189a70399d82c82ca0f2b17c35f998`. The final correction commit SHA is recorded in the delivery and Git history; it is not inferred from the starting candidate.

Validation used the preserved, pre-existing local tooling changes: pnpm 12.15.0, `package.json` Git blob `21b36eeed0290f7c33223f75a14beca4dffb9c55` and lockfile blob `6548e18cdb1e0b3a7f4e5232fbeac6a7b633abb4`. Those changes are excluded from the correction commit, whose tracked package-manager declaration remains pnpm 11.25.0. Reproducible validation of the committed dependency/tooling baseline or separate adoption of the local tooling change remains part of human validation; success here is not evidence of a clean frozen install with that other baseline. Lint retains existing delivery-tool import warnings; they are not new IAM errors.

Merge recommendation: the scoped corrections are technically ready for candidate-bound human validation. Do not infer permission to merge, complete the full configuration feature or set Work Status to Done from these agent results. The existing separate session-management credential/reference redesign also remains outside this correction.
