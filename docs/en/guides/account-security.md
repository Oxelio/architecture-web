# Account security, MFA, audit, and configuration

This guide describes the implementation currently located in
`apps/api/src/security`. It covers account recovery, TOTP MFA, auditing,
dynamic configuration, exports, and deferred deletion. Functional
specifications remain the source of expected behavior; this document describes
what the code executes today.

## Observed architectural placement

`SecurityService` is built in
`apps/api/src/composition-root/application.module.ts` and injected into:

- `buildSecurityRoutes`, for security endpoints;
- `createIam` as the `SecondFactorGate` implementation, allowing
  `SignInUseCase` to suspend session creation when a second factor is active.

This module is a hybrid vertical. Unlike the historical IAM core capabilities,
it does not consist of `Result`-returning use cases and dedicated repository
adapters. It imports Kysely, session and password ports, domain objects,
Nodemailer, and Node cryptographic primitives directly. `security.routes.ts`
therefore calls a concrete service and maps its `SecurityError` exceptions to
HTTP responses.

This organization is an **observed fact**, not a new general rule. It is an
exception to the boundaries documented for `packages/iam/core`. No ADR decides
whether the vertical should remain in the API or move to dedicated ports and
use cases.

## Persistence and secrets

Migration
`packages/iam/infrastructure/persitence/kysely/src/persistence/migrations/003_create_iam_security.ts`
adds:

| Table                           | Responsibility                                     |
| ------------------------------- | -------------------------------------------------- |
| `iam_password_recoveries`       | hashed recovery tokens, expiry, and consumption    |
| `iam_mfa_settings`              | encrypted TOTP secret and enrollment state         |
| `iam_mfa_backup_codes`          | SHA-256 backup-code derivatives and consumption    |
| `iam_mfa_challenges`            | temporary sign-in and confirmation challenges      |
| `iam_security_audit_events`     | append-only events, retention, and legal hold      |
| `iam_security_config_revisions` | published and superseded revisions                 |
| `iam_account_exports`           | temporary ZIP archive and lifecycle state          |
| `iam_account_deletions`         | grace period, cancellation, and possible retention |

Trigger `iam_users_invalidate_recoveries` invalidates recovery tokens after an
email change, password change, or transition to pending deletion.

Usable tokens are never persisted. TOTP secrets use AES-256-GCM encryption
derived from `SECURITY_ENCRYPTION_KEY`. Key rotation **MUST** include a
controlled migration; changing only the variable makes existing secrets
unreadable.

## Sign-in and MFA

After password validation, `SignInUseCase` calls
`SecondFactorGate.beginSignIn`. Without MFA it creates a session as before.
With MFA it returns a challenge and the controller responds with `202` and no
cookie. `POST /mfa/challenge/verify` then consumes a TOTP or backup code and
creates the session.

An active challenge is reused for the same account until expiry, so submitting
the correct password again does not reset its attempt counter. An accepted
TOTP counter cannot be replayed. Backup codes are independent, hashed, and
consumed atomically.

Enrollment has three final steps: QR-code creation, proof of an initial TOTP,
and explicit confirmation that backup codes were saved. Enabling or disabling
MFA revokes sessions.

## Recovery, export, and deletion

A recovery request always returns the same generic confirmation. Email and
network origin are stored in audit only as fingerprints. Limits apply to both a
known account and the origin. Token consumption and password-hash replacement
are transactional, followed by Redis session revocation.

An export creates a temporary ZIP archive in PostgreSQL containing a manifest,
account data, active sessions, accessible events, and request history. It
expires after 24 hours, and its first download removes the binary content.

A deletion request moves the user to `pending_deletion`, revokes sessions, and
creates a cancellation token. Maintenance deletes due accounts, pseudonymizes
their audits, expires archives, and purges audits outside retention. The last
active administrator is protected.

`POST /admin/security/maintenance` is the only composed trigger. The repository
contains no scheduler; deployment **MUST** invoke the route periodically.

## Dynamic configuration actually applied

The latest `published` revision is read from PostgreSQL, so no restart is
needed. Publication uses an expected version, with preview and rollback
endpoints.

| Option group                     | Current consumer                       |
| -------------------------------- | -------------------------------------- |
| sign-up and email change         | global hook in `server.ts`             |
| user session management          | global hook in `server.ts`             |
| recovery                         | `SecurityService.requestRecovery`      |
| MFA availability and roles       | enrollment, sign-in, and disabling     |
| export and deletion              | their respective workflows             |
| audit retention and consultation | writing, consultation, and maintenance |
| password lengths                 | recovery password reset only           |

`accounts.emailVerification` and `sessions.durationMinutes` are represented but
do not drive behavior. Dynamic password settings do not replace the
startup-built `PasswordPolicyValidator` used by sign-up and authenticated
password changes. The administrator UI must therefore not present these three
areas as universally effective.

## Audit and evidence limits

Historical IAM routes emit selected audits from the `onResponse` hook; security
workflows write events from the service. An audit failure in the hook is logged
without cancelling an already-sent response.

Current tests cover policy, redaction, TOTP, and ZIP primitives alongside the
existing monorepo suites. They are not an exhaustive integration suite for
concurrent transactions, maintenance, SMTP, or all PostgreSQL/Redis workflows.
This limitation **MUST** remain visible until dedicated integration coverage
exists.

Routes in `security.routes.ts` have no TypeBox schemas. Swagger may list them
without precise request and response definitions; this file and
`apps/web/src/services/api.ts` are currently the most precise executable
sources for these contracts.
