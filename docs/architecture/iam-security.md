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

Startup explicitly initializes the first revision when no published configuration exists. Subsequent reads use the complete published PostgreSQL snapshot. There is no process-local cache or environment fallback. Invalid persisted configuration raises a technical failure.

Publication takes a transaction-scoped advisory lock, rechecks the expected version, supersedes the current revision and inserts the complete replacement with its outbox event. A partial unique index prevents two published revisions. The same lock serializes first initialization. Existing duplicates cause migration failure rather than being deleted silently.

Preview evaluates one snapshot and returns its own before/after values. Set-valued changes are reported at their catalog key so critical-change confirmation cannot be bypassed through array indices. Restoration validates old values and creates a new revision. Critical confirmation remains the existing explicit confirmation, not step-up reauthentication.

## MFA and account data

MFA persistence locks the account before credential and challenge rows. Enrollment cannot replace an enabled factor. Confirmation checks the pending secret and increasing TOTP counter. Activation consumes a matching enrollment confirmation and invalidates sessions. Verification reserves attempts, consumes a factor and consumes its sign-in challenge in one transaction. Invalid attempts commit their counter; exhausted challenges are reused until expiry rather than reset by another password submission.

Export reservations serialize per account. Archive data uses explicit projections and excludes bearer session identifiers as well as password hashes, usable tokens and MFA secrets. Download takes and clears the binary atomically. Generation failure records `failed` and propagates the original technical exception.

Deletion requests serialize the last-administrator check, enter the domain's pending-deletion state, invalidate tokens and increment the session version. Cancellation rechecks expiry and consumption inside its transaction and restores the previous status without restoring sessions. Final deletion rechecks due state and legal hold under lock. Audit pseudonymization is an explicit cross-context call and can precede a PostgreSQL commit that later fails; retries must remain idempotent. IAM does not claim atomicity across context applications or external providers.

## Events and partial failures

Committed PostgreSQL security mutations append secret-free integration events to their transaction's outbox. Audit subscribes to these events and resolves retention through an injected application contract; Notifications uses its own policies and recipient directory. Recovery requests and transport-denial auditing use the explicit Audit integration adapter.

Session-started integration facts use version 2 and carry the account identifier rather than the bearer session identifier. Audit also redacts credential metadata on disclosure, so an export cannot reveal credentials from previously stored entries. Session-management contracts retain their existing identifiers; separating public management references from authentication credentials remains a distinct security change outside this refactoring.

Redis cleanup and messages containing plain verification, recovery or cancellation tokens remain post-commit. Their failure does not roll back committed PostgreSQL state. A stale session remains unusable through status/version checks even if Redis cleanup fails. Plain tokens are never put into the generic outbox. No distributed transaction or new encrypted message-delivery system is introduced.
