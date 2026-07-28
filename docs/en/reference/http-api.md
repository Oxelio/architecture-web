# HTTP interface reference

## Executable source

The API mounts routes under `/v<major-version>/identity`. With
`1.0.0-alpha.1`, the prefix is `/v1/identity`. TypeBox schemas feed OpenAPI,
available at `GET /docs`.

This page describes boundaries and access levels. Swagger and
`*.route-options.ts` files are the source of truth for exact bodies, statuses,
and responses.

## Public routes

| Method | Path                        | Intent                                |
| ------ | --------------------------- | ------------------------------------- |
| `GET`  | `/verify?token=...`         | verify an email                       |
| `POST` | `/signup`                   | create an account                     |
| `GET`  | `/password-policy`          | read the public password policy       |
| `POST` | `/password-policy/evaluate` | evaluate a password                   |
| `POST` | `/signin`                   | open a session                        |
| `POST` | `/signout`                  | close the session named by the cookie |

## Authenticated routes

| Method   | Path                      | Intent                |
| -------- | ------------------------- | --------------------- |
| `POST`   | `/verify/resend`          | resend verification   |
| `GET`    | `/me`                     | read the profile      |
| `PATCH`  | `/me/email`               | change email          |
| `PATCH`  | `/me/password`            | change password       |
| `GET`    | `/me/sessions`            | list own sessions     |
| `DELETE` | `/me/sessions/:sessionId` | revoke an own session |

## Administrator routes

| Method   | Path                                 | Intent                   |
| -------- | ------------------------------------ | ------------------------ |
| `GET`    | `/users`                             | list users               |
| `PATCH`  | `/users/:userId/activate`            | activate a user          |
| `PATCH`  | `/users/:userId/suspend`             | suspend a user           |
| `PATCH`  | `/users/:userId/role`                | assign `user` or `admin` |
| `GET`    | `/users/:userId/sessions`            | list sessions            |
| `DELETE` | `/users/:userId/sessions/:sessionId` | revoke one session       |
| `DELETE` | `/users/:userId/sessions`            | revoke all sessions      |

## Envelopes

The web client expects JSON successes as `{ "data": ... }`; no-content
responses use `204`. HTTP errors use
`{ "error": { "code": "...", "message"?: "..." } }`.

Business codes are defined next to use cases in `*.codes.ts`. HTTP mappings
live in `*.http.ts`. Cross-cutting `UNAUTHORIZED` and `FORBIDDEN` codes are
produced by authentication and authorization hooks.

`POST /signup` requires `email`, `password`, and `passwordConfirmation`.
`PATCH /me/password` requires `currentPassword`, `password`, and
`passwordConfirmation`. Confirmations are compared exactly and then discarded;
they never reach persistence.

## Version and breaking changes

Changing a path, method, status, envelope, required field, or code meaning is
breaking for clients. Web client, schemas, presenters, tests, and this reference
**MUST** change together. The route version currently follows the API package
major version; no parallel deprecation policy is defined.
