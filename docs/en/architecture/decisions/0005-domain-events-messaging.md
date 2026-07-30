# ADR-0005 — Domain Events and cross-context delivery

**Status: accepted**

## Context

IAM must feed user and administrator notifications and an audit trail without
knowing their models or delivery channels. Effects triggered after a PostgreSQL
write must be recoverable after an outage without undoing an already completed
business operation.

The architecture already has aggregate roots and a PostgreSQL unit of work.
Sessions remain stored separately in Redis.

## Considered options

1. keep every side effect directly in use cases;
2. publish only in-memory events after writes;
3. record Domain Events in aggregates, translate them into integration
   contracts, and deliver them through a transactional outbox.

## Decision

Foundation provides the generic `DomainEvent` primitive. `AggregateRoot`
records pending events and lets persistence release them after saving.

IAM owns its business events and their translation into versioned integration
contracts. A PostgreSQL save through `IamUnitOfWork` writes business state and
outgoing messages in the same transaction.

The `@architecture/messaging` core provides the outbox domain, integration
envelope, ports, router, and worker. The
`@architecture/messaging-persistence-kysely` adapter implements the outbox
ports and owns the PostgreSQL migration. Delivery is at least once; consumers
are idempotent through the stable event identifier. Failures are retried with
backoff and moved to a permanent failure state after ten attempts.

Audit and Notifications are separate bounded contexts:

- Audit keeps append-only evidence, applies retention, and serves queries;
- Notifications owns its aggregate, read state, preferences, and delivery
  requests; its infrastructure packages implement Kysely, email, Slack, SMS,
  and the IAM directory;
- the Web client reads persisted notifications and periodically polls the
  unread count.

Events related to a Redis session are persisted to the outbox after the Redis
operation succeeds. Because PostgreSQL and Redis share no transaction, this
sequence does not provide the same atomicity as PostgreSQL commands.

The outbox, router, and workers are shared technical infrastructure, not a DDD
Shared Kernel. Other bounded contexts consume the producer’s public contracts
and do not import its entities.

## Consequences

- adding a consumer no longer changes the producing aggregate;
- Audit and Notifications may fail temporarily without losing committed
  PostgreSQL facts;
- handlers must remain idempotent and contracts must be versioned;
- API startup assumes messaging, audit, and notification migrations have run;
- permanent failures require monitoring;
- email containing a verification token remains in the protected application
  flow: the plain token enters neither a generic Domain Event nor Audit;
- no distributed-transaction guarantee is claimed for Redis.
