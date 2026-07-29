# Authentication and sessions

## Creation

`POST /v1/iam/signin` validates credentials through `SignInUseCase`. A
successful sign-in creates a 60-minute `SessionEntity` and returns an `httpOnly`
`sid` cookie.

When MFA is active, password validation does not create a session yet.
`SignInUseCase` returns the challenge supplied by `SecondFactorGate`, the
controller responds with `202`, and `POST /v1/iam/mfa/challenge/verify`
creates the session after second-factor validation. See the
[security guide](account-security.md).

Before storing a new session, `SignInUseCase` loads active sessions and revokes
the oldest ones that would exceed the limit of 10. This bound keeps personal
and administrative session lists durable without pagination.

The controller also derives client type/name/version from `User-Agent`, device
and operating-system hints, and the IP address provided by Fastify. This is
indicative metadata, not strong device identification.

## Storage

`RedisSessionAdapter` stores each session as `session:<sessionId>` with a TTL
and indexes active IDs under `user-sessions:<userId>`. The format is
intentionally strict: `userId`, `expiresAt`, `createdAt`, and `lastActivityAt`
must be present and valid. Incomplete or invalid records are rejected when
loaded. `client` and `network` remain optional. PostgreSQL does not store
current sessions.

## Resolution and activity

The Fastify plugin reads the cookie, calls `ResolveSessionUseCase`, and fills
`request.auth` with `userId`, `sessionId`, and `role`. It rejects missing or
invalid cookies, missing or expired sessions, and missing or suspended users.
Activity is updated at most once every five minutes to avoid a Redis write per
request.

`pending_deletion` is also refused because resolution now requires an active
account.

## Authorization

Protected routes use `authenticate`. Administrator routes add
`role === "admin"`. `/me/sessions` always passes the authenticated owner to the
use case, so the client cannot choose another user.

Suspension revokes all sessions. Password changes also revoke sessions as
defined by the use case. Sensitive administration operations prevent certain
self-actions through `user.self_administration_forbidden`.

Account recovery, MFA activation or disabling, and a deletion request also
revoke sessions.

Password changes first verify the current password, then confirmation and the
[central policy](password-policy.md). Sessions are revoked only after
validation and persistence succeed.

## Listing and revocation

Users can list and revoke their sessions. Administrators can list one user's
sessions and revoke one or all. The contract includes current-session state,
dates, client, and network information.

Approximate location exists in the model and contract, but no IP-geolocation
mechanism is currently composed. Location therefore remains `null` until a
dedicated mechanism supplies it.

## Security and privacy

- The cookie **MUST** remain `httpOnly`.
- Cross-site production HTTPS uses `COOKIE_SECURE=true` for
  `SameSite=None; Secure`.
- Enable `TRUST_PROXY=true` only behind a trusted proxy because `request.ip`
  affects collected metadata.
- IP and client data are sensitive. Longer retention, geolocation, or broader
  exposure requires product and compliance decisions.

Dynamic configuration represents `sessions.durationMinutes`, but
`SessionEntity` currently keeps its hard-coded 60-minute lifetime. Changing
that option does not alter the actual TTL.
