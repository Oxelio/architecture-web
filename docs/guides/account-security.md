# Account security, MFA, audit, and configuration

Security workflows are application use cases in `packages/contexts/iam`, wired in `apps/api/src/composition-root/iam.module.ts`. HTTP endpoints live under `apps/api/src/features/iam/security`. See [IAM security architecture](../architecture/iam-security.md) for code ownership, transactions and partial failures.

## MFA and recovery

Password validation precedes `BeginSecondFactorUseCase`. An enrolled account receives a temporary challenge and no session cookie. MFA completion verifies and consumes the factor/challenge before issuing a session. Challenges retain their attempt limit across repeated password submissions. TOTP counters and backup codes cannot be reused.

Enrollment requires recent authentication and password verification, a first valid TOTP, and confirmation that generated backup codes were saved. Starting enrollment cannot erase an enabled factor. Activation and deactivation invalidate sessions. MFA remains enabled after password recovery.

Recovery requests return a generic confirmation for eligible and ineligible accounts. Tokens are stored only as hashes and expire, are superseded by later requests and are consumed atomically with password replacement. Complete password validation applies according to the account's persisted role. Recovery does not verify an email implicitly, remove suspension or sign the user in.

TOTP secrets are encrypted with AES-256-GCM using a key derived from `SECURITY_ENCRYPTION_KEY`. Changing that key still requires a controlled secret migration. Plain recovery, verification and cancellation links are sent after commit and are not stored in the generic outbox.

## Export and deletion

An export requires recent authentication, fresh password proof and MFA when enabled. Explicit projections build a versioned ZIP containing account/identity data, session metadata, visible audit events and request history. Credentials, bearer session identifiers and MFA secrets are excluded. Binary data expires after 24 hours and is consumed once on download.

Deletion enters `pending_deletion`, invalidates tokens and sessions, and sends a cancellation link to the verified address. Cancellation restores the previous status without restoring sessions. Maintenance processes due requests, honors legal hold, coordinates Audit pseudonymization and expires archives. Audit owns retention purge. The last active administrator is protected against concurrent deletion requests.

`POST /v1/iam/admin/security/maintenance` remains the composed maintenance trigger; deployment scheduling is not added here.

## Dynamic configuration

The application reads complete published PostgreSQL revisions without local caching. Administrators can consult, preview, publish with an expected version and restore previous values. Publication and its event are transactional. Configuration consumption uses narrow capability readers; publication uses separate administrative contracts.

The catalog describes executable sign-up, identity-verification, email-change, session, recovery, MFA, export, deletion and password settings. Password settings affect creation/replacement, not existing-password sign-in. Session duration is applied by the shared session issuance flow.

The editor retains its typed fields, reason, confirmation, history and restoration. Critical confirmation is an explicit confirmation rather than step-up authentication. Per-instance propagation telemetry is not added; new backend reads observe the current database revision.

## Evidence limits

Focused domain, application, adapter and HTTP tests cover important rules and failure contracts. An opt-in suite exercises PostgreSQL/Redis races, transactional outbox rollback, stale-session rejection, MFA consumption, archive download and administrator deletion. See [Testing](../development/testing.md) for the isolated environment and commands. A skipped integration suite is not evidence that the real scenarios passed.
