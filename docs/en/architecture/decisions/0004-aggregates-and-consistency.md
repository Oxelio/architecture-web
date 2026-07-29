# ADR-0004 — Aggregates and consistency boundaries

**Status: accepted**

## Context

`UserEntity`, `SessionEntity`, and `EmailVerificationEntity` already had
identity, transitions, and separate repositories without declaring their role
as aggregate roots. Several commands wrote a user and a verification to
PostgreSQL sequentially. Sign-in enforced the session limit through a separate
read, deletion sequence, and Redis write.

## Considered options

1. Keep entities only and accept sequential writes.
2. Build one large `User` aggregate containing sessions and verifications.
3. Declare three single-entity aggregates and provide consistency suited to
   each technology.

## Decision

Foundation defines `AggregateRoot` as a stateless specialization of `Entity`.
IAM declares `UserEntity`, `SessionEntity`, and `EmailVerificationEntity` as
distinct aggregate roots. They reference one another by identifier only.

`IamUnitOfWork` wraps PostgreSQL commands that write user and verification
aggregates in one Kysely transaction. Repositories received by its callback are
bound to that transaction.

`RedisSessionAdapter.saveEnforcingMaximum` saves a session and enforces the
per-user limit in one atomic Redis script. A session version held by the user
and copied into each session invalidates sessions created before a password
change.

## Consequences

- a PostgreSQL failure can no longer commit only half of a
  user/verification change;
- concurrent sign-ins through the IAM use case cannot exceed the session
  limit;
- PostgreSQL and Redis remain separate systems without a distributed
  transaction;
- session resolution reloads the user and rejects a stale version, making
  password-change revocation safe even when Redis cleanup fails;
- adding a root to a transaction requires explicitly extending
  `IamTransactionalRepositories`.

## Open limits

Verification email is sent after commit, but no durable outbox exists. Such an
evolution must protect the raw token at rest and define its worker, retries,
and idempotency before being introduced.
