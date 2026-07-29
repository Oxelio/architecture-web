# HTTP interface reference

## Executable source

The API mounts routes under `/v<major-version>/iam`. With
`1.0.0-alpha.1`, the prefix is `/v1/iam`. TypeBox schemas feed OpenAPI,
available at `GET /docs`.

This page describes boundaries and access levels. For historical routes,
`*.route-options.ts` files and Swagger describe exact bodies, statuses, and
responses. Security routes declared in
`apps/api/src/security/security.routes.ts` do not have TypeBox schemas yet:
that file and `apps/web/src/services/api.ts` are their executable source, and
Swagger does not currently cover the whole API.

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
| `search`        | string, at most 200 characters | absent  | email or identifier         |
| `role`          | `user`, `admin`                | absent  | equality                    |
| `status`        | `active`, `suspended`          | absent  | equality                    |
| `emailVerified` | boolean                        | absent  | equality                    |
| `page`          | strictly positive integer      | `1`     | an empty page is valid      |
| `pageSize`      | integer from `1` through `100` | `25`    | larger values are forbidden |

Present criteria combine with `AND`. `meta.pagination.total` is computed after
applying them. `totalPages` is `0` when total is zero.

Fastify normally rejects invalid pagination through its schema. Application
errors `users.invalid_page` and `users.invalid_page_size` also preserve the rule
for another interface; the HTTP mapping exposes them as `INVALID_PAGE` and
`INVALID_PAGE_SIZE`, respectively.

See [User administration](../guides/iam-user-administration.md) for the complete
application, persistence, and client flow.
See also [Account security](../guides/account-security.md) for recovery, MFA,
audit, configuration, export, and deletion flows.

Business codes are defined next to use cases in `*.codes.ts`. HTTP mappings
live in `*.http.ts`. Cross-cutting `UNAUTHORIZED` and `FORBIDDEN` codes are
produced by authentication and authorization hooks.

An account keeps at most 10 active sessions. A new sign-in above this limit
first revokes the oldest active session, keeping session lists bounded without
pagination.

`POST /signup` requires `email`, `password`, and `passwordConfirmation`.
`PATCH /me/password` requires `currentPassword`, `password`, and
`passwordConfirmation`. Confirmations are compared exactly and then discarded;
they never reach persistence.

## Version and breaking changes

Changing a path, method, status, envelope, required field, or code meaning is
breaking for clients. Web client, schemas, presenters, tests, and this reference
**MUST** change together. The route version currently follows the API package
major version; no parallel deprecation policy is defined.
