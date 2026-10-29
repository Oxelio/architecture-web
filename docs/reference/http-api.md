# HTTP interface reference

## Executable source

The API mounts routes under `/v<major-version>/iam`. With
`1.0.0-alpha.1`, the prefix is `/v1/iam`. TypeBox schemas feed OpenAPI,
available at `GET /docs`.

This page describes boundaries and access levels. IAM routes use the
`/v1/iam` prefix and the notification center uses `/v1/notifications`. For historical routes,
`*.route-options.ts` files and Swagger describe exact bodies, statuses, and
responses. Security routes now live in `apps/api/src/features/iam/security/security.routes.ts`.
They declare TypeBox schemas for recovery, MFA, account-data and configuration request bodies/parameters, and personal audit pagination. Error response envelopes are declared; success response schemas and administrative audit filters are not yet exhaustive; Swagger does not describe the whole API. Notification routes retain their separate transport coverage. The route implementations and `apps/web/src/services/api.ts` remain the executable sources for uncovered contracts.

## Public routes

| Method | Path                        | Intent                                |
| ------ | --------------------------- | ------------------------------------- |
| `GET`  | `/verify?token=...`         | verify an email                       |
| `POST` | `/signup`                   | create an account                     |
| `GET`  | `/password-policy`          | read the public password policy       |
| `POST` | `/password-policy/evaluate` | evaluate a password                   |
| `POST` | `/signin`                   | open a session                        |
| `POST` | `/signout`                  | close the session named by the cookie |
| `POST` | `/recovery`                 | request account recovery              |
| `POST` | `/recovery/reset`           | reset the password                    |
| `POST` | `/mfa/challenge/verify`     | complete an MFA sign-in               |
| `POST` | `/deletion/cancel`          | cancel deletion with a token          |

## Authenticated routes

| Method   | Path                                      | Intent                       |
| -------- | ----------------------------------------- | ---------------------------- |
| `POST`   | `/verify/resend`                          | resend verification          |
| `GET`    | `/me`                                     | read the profile             |
| `PATCH`  | `/me/email`                               | change email                 |
| `PATCH`  | `/me/password`                            | change password              |
| `GET`    | `/me/sessions`                            | list own sessions            |
| `DELETE` | `/me/sessions/:sessionId`                 | revoke an own session        |
| `GET`    | `/me/security-events`                     | read own security events     |
| `GET`    | `/me/mfa`                                 | read MFA state               |
| `POST`   | `/me/mfa/enrollment`                      | start TOTP enrollment        |
| `POST`   | `/me/mfa/enrollment/confirm`              | validate the first TOTP code |
| `POST`   | `/me/mfa/enrollment/backup-codes/confirm` | confirm backup-code storage  |
| `POST`   | `/me/mfa/backup-codes`                    | regenerate backup codes      |
| `DELETE` | `/me/mfa`                                 | disable MFA                  |
| `POST`   | `/me/exports`                             | request an account export    |
| `GET`    | `/me/exports`                             | list own exports             |
| `GET`    | `/me/exports/:exportId/download`          | download a ready archive     |
| `POST`   | `/me/deletion`                            | schedule account deletion    |

### Notification center (`/v1/notifications`)

| Method | Path                    | Intent                                    |
| ------ | ----------------------- | ----------------------------------------- |
| `GET`  | `/`                     | list own notifications                    |
| `GET`  | `/unread-count`         | count own unread notifications            |
| `POST` | `/:notificationId/read` | mark one notification as read             |
| `POST` | `/read-all`             | mark all own notifications as read        |
| `GET`  | `/preferences`          | read per-channel preferences              |
| `PUT`  | `/preferences/:channel` | enable or disable `email`, `slack`, `sms` |

## Administrator routes

| Method   | Path                                          | Intent                          |
| -------- | --------------------------------------------- | ------------------------------- |
| `GET`    | `/users`                                      | search and paginate users       |
| `GET`    | `/users/overview`                             | get global user indicators      |
| `PATCH`  | `/users/:userId/activate`                     | activate a user                 |
| `PATCH`  | `/users/:userId/suspend`                      | suspend a user                  |
| `PATCH`  | `/users/:userId/role`                         | assign `user` or `admin`        |
| `GET`    | `/users/:userId/sessions`                     | list sessions                   |
| `DELETE` | `/users/:userId/sessions/:sessionId`          | revoke one session              |
| `DELETE` | `/users/:userId/sessions`                     | revoke all sessions             |
| `GET`    | `/admin/security/config`                      | read published configuration    |
| `PUT`    | `/admin/security/config`                      | publish a new revision          |
| `POST`   | `/admin/security/config/preview`              | preview configuration           |
| `POST`   | `/admin/security/config/:revisionId/rollback` | republish an old revision       |
| `GET`    | `/admin/security-events`                      | search audit events             |
| `POST`   | `/admin/security/maintenance`                 | run retention and due deletions |

## Envelopes

The web client expects JSON successes as `{ "data": ... }`. The paginated
administration list also includes
`{ "meta": { "pagination": { "page", "pageSize", "total", "totalPages" } } }`.
Its optional parameters are `search`, `role`, `status`, `emailVerified`, `page`,
and `pageSize` (25 by default, 100 at most). Global indicators are a separate
resource in `data` at `/users/overview`.

No-content responses use `204`. HTTP errors use
`{ "error": { "code": "...", "message"?: "..." } }`.

`POST /signin` returns either `204` with the session cookie or `202` with
`mfaRequired`, `challengeId`, and `expiresAt`. In the second case, no cookie is
issued until `POST /mfa/challenge/verify` succeeds.

### Administration read

| Parameter       | Values                         | Default | Rule                        |
| --------------- | ------------------------------ | ------- | --------------------------- |
| `search`        | string, at most 200 characters | absent  | account or login identifier |
| `role`          | `user`, `admin`                | absent  | equality                    |
| `status`        | `active`, `suspended`          | absent  | equality                    |
| `emailVerified` | boolean                        | absent  | equality                    |
| `page`          | strictly positive integer      | `1`     | an empty page is valid      |
| `pageSize`      | integer from `1` through `100` | `25`    | larger values are forbidden |

Present criteria combine with `AND`. `meta.pagination.total` is computed after
applying them. `totalPages` is `0` when total is zero.

Fastify normally rejects invalid pagination through its schema. Application
errors `users.invalid_page` and `users.invalid_page_size` also preserve the rule
for another interface; HTTP exposes those same codes.

See [User administration](../guides/iam-user-administration.md) for the complete
application, persistence, and client flow.
See also [Account security](../guides/account-security.md) for recovery, MFA,
audit, configuration, export, and deletion flows.

Business errors are defined next to their use case in `*.contracts.ts` or an
optional `*.errors.ts` catalog. HTTP mappings live in `*.http.ts` and preserve
application codes. Authentication and authorization hooks use
`authentication.unauthorized` and `authorization.forbidden`, respectively.
Generic schema failures use `request.validation_failed`; other rejected client
requests use `request.invalid`. Unexpected server failures expose
`internal.unexpected_error`.

An account keeps at most 10 active sessions. A new sign-in above this limit
first revokes the oldest active session, keeping session lists bounded without
pagination.

`POST /signup` requires
`login: { kind: "username" | "email", value: string }`, `password`, and
`passwordConfirmation`. `POST /signin` uses the same `login` object and
`password`. Allowed kinds come from `GET /capabilities` and the published
policy; email is not mandatory for a pseudonymous account.
`PATCH /me/password` requires `currentPassword`, `password`, and
`passwordConfirmation`. Confirmations are compared exactly and then discarded;
they never reach persistence.

## Version and breaking changes

Changing a path, method, status, envelope, required field, or code meaning is
breaking for clients. Web client, schemas, presenters, tests, and this reference
**MUST** change together. The route version currently follows the API package
major version; no parallel deprecation policy is defined.

## IAM correction compatibility

Paths, methods, success envelopes and cookie attributes are preserved. Missing/invalid recovery email returns `400 email.invalid_format`, missing reset fields return `400 password_recovery.invalid_request`, and mismatched confirmation returns `400 password.confirmation_mismatch`. Application password validation returns the specific error, such as `password.too_short` or `password.too_long`, with its diagnostic fields. A reset rejected by the transport size bound uses `password.policy_violation`. Successful MFA deactivation returns 204 and clears the authentication cookie; failed deactivation leaves it unchanged. Server-side session invalidation remains independent of cookie removal.

Configuration publication retains `values`, `expectedVersion`, `justification` and `confirmedCritical`. Critical changes additionally require fresh proof using optional transport fields `password` and `mfaCode`; session identity is obtained from authenticated context. The critical checkbox alone is insufficient. Restoration now takes a body with required `expectedVersion` and `justification`, plus `confirmedCritical`, `password` and `mfaCode` when critical. This coordinated client/API safeguard migration is required by the approved security-configuration specification; no parallel HTTP versioning policy is introduced.

History additionally exposes recorded `justification`, `origin`, `changes` and `restored_from_revision_id`; absent historical metadata is null. `administrator.last_active_access` is a 409 refusal when a change would remove the final usable access path. `security_configuration.version_conflict` remains 409; invalid fresh authentication returns its established authorization error. The package-source migration is inventoried in [Packages](../architecture/packages.md). Session-started integration facts remain version 2 and exclude bearer identifiers; existing consumers and redaction protections remain in place.

## Error-code migration

This is a coordinated breaking change: callers must update comparisons against
the former uppercase HTTP codes. Codes now follow the
[application naming convention](../development/conventions.md), and HTTP no
longer maintains a second vocabulary for the same business failure.

| Former code                                                                     | Current code                                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `INVALID_CREDENTIALS`                                                           | `authentication.invalid_credentials`                                                                           |
| `UNAUTHORIZED` / `FORBIDDEN`                                                    | `authentication.unauthorized` / `authorization.forbidden`                                                      |
| `LAST_ACTIVE_ADMIN`                                                             | `administrator.last_active_access`                                                                             |
| `ACCOUNT_CONCURRENT_MODIFICATION`                                               | `account.concurrent_modification`                                                                              |
| `RECENT_AUTHENTICATION_REQUIRED`                                                | `authentication.recent_proof_required`                                                                         |
| `MFA_CHALLENGE_INVALID` / `MFA_CODE_INVALID`                                    | `mfa.invalid_challenge` / `mfa.invalid_code`                                                                   |
| `MFA_ENROLLMENT_INVALID` / `MFA_ENROLLMENT_REQUIRED`                            | `mfa.invalid_enrollment` / `mfa.enrollment_required`                                                           |
| `MFA_UNAVAILABLE` / `MFA_ALREADY_ENABLED` / `MFA_NOT_ENABLED`                   | `mfa.unavailable` / `mfa.already_enabled` / `mfa.not_enabled`                                                  |
| `MFA_CODE_REQUIRED` / `MFA_REQUIRED_BY_POLICY`                                  | `mfa.code_required` / `mfa.required_by_policy`                                                                 |
| `MFA_BACKUP_CODES_CONFIRMATION_REQUIRED`                                        | `mfa.backup_codes_confirmation_required`                                                                       |
| `STRONG_AUTHENTICATION_REQUIRED`                                                | `authentication.strong_proof_required`                                                                         |
| `RECOVERY_TOKEN_INVALID` / `RECOVERY_REQUEST_INVALID`                           | `password_recovery.invalid_token` / `password_recovery.invalid_request`                                        |
| `EXPORT_DISABLED` / `EXPORT_NOT_AVAILABLE`                                      | `account_export.disabled` / `account_export.not_available`                                                     |
| `DELETION_DISABLED` / `DELETION_TOKEN_INVALID`                                  | `account_deletion.disabled` / `account_deletion.invalid_token`                                                 |
| `DELETION_CONFIRMATION_REQUIRED`                                                | `account_deletion.confirmation_required`                                                                       |
| `DELETION_REQUEST_INVALID` / `DELETION_CANCELLATION_INVALID`                    | `account_deletion.invalid_request` / `account_deletion.invalid_cancellation_request`                           |
| `CONFIG_INVALID` / `CONFIG_VERSION_CONFLICT`                                    | `security_configuration.invalid` / `security_configuration.version_conflict`                                   |
| `CONFIG_JUSTIFICATION_REQUIRED` / `CONFIG_CRITICAL_CONFIRMATION_REQUIRED`       | `security_configuration.justification_required` / `security_configuration.critical_confirmation_required`      |
| `CONFIG_REVISION_NOT_FOUND`                                                     | `security_configuration.revision_not_found`                                                                    |
| `TOKEN_INVALID` / `TOKEN_EXPIRED`                                               | `email_verification.invalid_token` / `email_verification.expired_token`                                        |
| `EMAIL_ALREADY_VERIFIED` / `TOO_MANY_REQUESTS`                                  | `email_verification.already_verified` / `email_verification.too_many_requests`                                 |
| `FEATURE_DISABLED`                                                              | `registration.disabled`, `email_change.disabled`, or `session_management.disabled`, according to the operation |
| `ADMINISTRATOR_UNAUTHORIZED` / `SELF_ADMINISTRATION_FORBIDDEN`                  | `administrator.unauthorized` / `user.self_administration_forbidden`                                            |
| `INVALID_USER_ID` / `USER_NOT_FOUND` / `USER_ALREADY_EXISTS` / `USER_SUSPENDED` | `user.invalid_id` / `user.not_found` / `user.already_exists` / `user.suspended`                                |
| `INVALID_SESSION_ID` / `SESSION_NOT_FOUND`                                      | `session.invalid_id` / `session.not_found`                                                                     |
| `ROLE_REQUIRED` / `ROLE_INVALID`                                                | `user_role.empty` / `user_role.invalid`                                                                        |
| `INVALID_PAGE` / `INVALID_PAGE_SIZE`                                            | `users.invalid_page` / `users.invalid_page_size`                                                               |
| `EMAIL_REQUIRED` / `EMAIL_INVALID` / `EMAIL_TOO_LONG`                           | `email.empty` / `email.invalid_format` / `email.too_long`                                                      |
| `PASSWORD_*`                                                                    | The corresponding `password.*` code, for example `PASSWORD_TOO_COMMON` becomes `password.too_common`           |
| `AUDIT_CONSULTATION_DISABLED`                                                   | `audit_consultation.disabled`                                                                                  |
| `INTERNAL_SERVER_ERROR` / `FST_ERR_VALIDATION`                                  | `internal.unexpected_error` / `request.validation_failed`                                                      |

Registration additionally exposes `registration.disabled` (403) and
`login_identifier.empty`, `login_identifier.invalid_kind`,
`login_identifier.invalid_email`, `login_identifier.invalid_username`, and
`login_identifier.not_allowed` (400). Its previous email-only mapping did not
cover these application outcomes.

Application package consumers use `<Action>Errors` catalogs rather than the
former `ErrorCodes`/`ErrorsCodes` names. Grouped security implementations have
individual action directories and explicit public contracts. The open-ended
`IamResult<T>` export is removed; consume the operation's `<Action>Output` and
`<Action>Error`. `getCapabilities.execute()` now returns a typed application
result; its HTTP `{ data: ... }` envelope is unchanged.
The successful `ListUsersResult` payload is renamed `UserList` to distinguish
it from the complete `ListUsersOutput` outcome.
