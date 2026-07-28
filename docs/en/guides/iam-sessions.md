# Authentication and sessions

## Creation

`POST /v1/iam/signin` validates credentials through `SignInUseCase`. A
successful sign-in creates a 60-minute `SessionEntity` and returns an `httpOnly`
`sid` cookie.

The controller also derives client type/name/version from `User-Agent`, device
and operating-system hints, and the IP address provided by Fastify. This is
indicative metadata, not strong device identification.

## Storage

`RedisSessionAdapter` stores each session as `session:<sessionId>` with a TTL
and indexes active IDs under `user-sessions:<userId>`. Older records without
metadata remain readable; missing dates and details become `null` in the
application contract. PostgreSQL does not store current sessions.

## Resolution and activity

The Fastify plugin reads the cookie, calls `ResolveSessionUseCase`, and fills
`request.auth` with `userId`, `sessionId`, and `role`. It rejects missing or
invalid cookies, missing or expired sessions, and missing or suspended users.
Activity is updated at most once every five minutes to avoid a Redis write per
request.

## Authorization

Protected routes use `authenticate`. Administrator routes add
`role === "admin"`. `/me/sessions` always passes the authenticated owner to the
use case, so the client cannot choose another user.

Suspension revokes all sessions. Password changes also revoke sessions as
defined by the use case. Sensitive administration operations prevent certain
self-actions through `user.self_administration_forbidden`.

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
