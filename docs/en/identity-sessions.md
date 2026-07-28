# Identity sessions

A session stores its internal identifier, owner, creation time, last activity,
and expiration. It may also include optional client metadata (device type,
operating system, browser or application) and network metadata (IP address and
approximate location).

The HTTP adapter translates `User-Agent` and `request.ip` into domain metadata
at sign-in. Forwarded headers are honored only with `TRUST_PROXY=true`, which
must only be enabled behind a trusted reverse proxy. Location is optional and
no external provider is required.

Last activity is initialized at creation and persisted during authentication
only when the stored value is at least five minutes old. Redis keeps the
original TTL. Existing records remain readable with unknown or `null` values,
so no Redis migration is required.

User routes still derive ownership from `request.auth`; administrative routes
retain their role checks. API responses never expose cookies, secrets, or
usable tokens.

The list response adds `userId`, `createdAt`, `lastActivityAt`, `isActive`,
`isCurrent`, `client`, and `network`. This is additive for consumers that
ignore unknown response fields.
