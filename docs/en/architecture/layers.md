# Layers and boundaries

## Foundation

`packages/foundation` provides `AggregateRoot`, `DomainEvent`, `Entity`,
`Identifier`, `ValueObject`, `Result`, and `ValueOf`. It contains no
IAM-specific rule. `AggregateRoot` marks the entry point of a consistency
boundary and collects business events without depending on a repository or
database.

It **MAY** contain a generic primitive useful to multiple domains. It **MUST
NOT** import a business package, application, or infrastructure technology.
Because a Foundation abstraction couples every consumer, additions **SHOULD**
answer at least two real needs.

## IAM domain

`packages/iam/core/domain` contains entities and value objects. An entity
has an identity and business transitions; a value object validates and wraps a
value without its own identity.

The domain **MAY** depend on Foundation and its own types. It **MUST NOT** import
use cases, Fastify, React, Kysely, Redis, an email SDK, or an adapter.

Examples include `UserEntity` for account transitions, `SessionEntity` for
lifetime and validity, and `EmailValueObject.create` for validation through a
`Result`.

`UserEntity`, `SessionEntity`, and `EmailVerificationEntity` are the current
three aggregate roots. A repository **MUST** load or save a root and **MUST
NOT** expose direct mutation of an internal aggregate object. References
between aggregates **MUST** use identifiers.

Static factories have different meanings: `create` builds new valid state and
applies defaults, while `rehydrate` restores already persisted state.

## IAM application

`packages/iam/core/application` exposes use cases, input/output contracts,
codes, and required ports. A use case orchestrates a business intent and
returns a `Result`.

This layer **MAY** depend on the domain, Foundation, and its own ports. It
**MUST NOT** depend on Kysely, Redis, Argon2, Nodemailer, Postmark, or Fastify
implementations.

Repositories and abstract services are secondary ports. `IamUnitOfWork`
provides a transaction spanning PostgreSQL user and verification repositories.
`createIam` is the application factory: it receives `IamDependencies` and
returns the `IamApplication` use-case set.

`SecondFactorGate` is a special port called by `SignInUseCase`. Its composed
implementation is `SecurityService`, located in the API rather than an
infrastructure package.

Coherent operations backed by the same implementation are grouped:
`UserRepository` owns writes, account lookup, bounded administration search,
and indicators; `SessionRepository` owns session lifecycle and listing. A port
name is not an authorization mechanism: authorization remains in use cases.

Administration commands require the actor identifier.
`AdministratorAuthorizer` reloads that actor from the repository and verifies
that the account is active and has the administrator role, independently from
Fastify. Personal-session operations use distinct use cases from
administrative-session operations.

## Infrastructure

Each package under `packages/iam/infrastructure` adapts one technology to
a public application port. It **MUST** state compatibility with `implements`,
for example
`RedisSessionAdapter implements SessionRepository`.

An adapter **MAY** depend on public `application` and `domain` exports and on
its targeted library. It **MUST NOT** bypass core exports or import an
application.

Persistence mappers belong here. `UserMapper`, for example, converts Kysely
rows to `UserEntity` and rejects invalid persisted data with
`InvalidPersistenceDataError`.

`KyselyIamUnitOfWorkAdapter` provides repositories bound to one transaction.
`RedisSessionAdapter.saveEnforcingMaximum` uses one Redis script to save the
session, clean the expired index, and revoke excess sessions.

## Messaging, Audit, and Notifications

`packages/messaging/core` separates the Messaging domain from its application.
The domain owns the integration envelope, `OutboxMessageEntity`, and its value
objects. The application exposes `OutboxWriter`, `OutboxRepository`, the
router, and the worker without depending on a database. The PostgreSQL
implementation and migration belong to
`packages/messaging/infrastructure/persistence/kysely`.

`packages/audit` is an append-only bounded context. It consumes integration
events and application or security attempts, applies redaction, and exposes
search, export, retention, and pseudonymization operations.

`packages/notifications/core` is a separate bounded context. Its domain owns
`NotificationEntity`, `NotificationDeliveryEntity`,
`NotificationPreferenceEntity`, `NotificationRecipientEntity`, identifiers,
channels, and severities. A preference owns the recipient-channel composite
identity and its enabled-state transition. A recipient is an identified concept
built by the IAM directory adapter; it selects the destination compatible with
a channel without requiring its own persistence. `NotificationDeliveryEntity`,
a child of the `NotificationEntity` aggregate, owns claim, success, failure,
retry, and dead-letter transitions. The client-facing DTO remains an
application contract.

The application turns received facts into aggregates, exposes each intention
in a use-case directory with its contract and any stable error codes, and
schedules deliveries according to preferences and mandatory policies.
`NotificationRepository` and `NotificationPreferenceRepository` each save
their aggregate root; the `NotificationDelivery` and
`NotificationRecipientDirectory` ports are abstract classes whose signatures
use domain objects directly.

Implementations remain under `packages/notifications/infrastructure`: Kysely
persistence, Nodemailer email, separate Slack and SMS webhooks, and a Kysely
directory adapting IAM users to `NotificationRecipientDirectory`. The core
knows none of these choices.

## Fastify API

`apps/api` is both the primary HTTP adapter and the composition root:

- `server.ts` configures Fastify, CORS, Swagger, authentication, and routes;
- `composition-root` creates PostgreSQL, Redis, and adapters, then calls
  `createIam`;
- `features/iam` groups controller, HTTP contract, presenter, and route
  options by feature;
- `routes` separates public, authenticated, and administrator endpoints.

`apps/api/src/security` uses a second HTTP organization. It groups a concrete
service, its types, and public/authenticated/administrator routes. The service
orchestrates Kysely and several technical ports directly, so it does not follow
the controller/use-case/adapter split described above for `features/iam`.

For `features/iam`, concrete implementations are allowed in
`composition-root`, not in controllers, which **MUST** call use-case
interfaces. `security.routes.ts` is an observed exception whose handlers call
`SecurityService` directly.

## React application

`apps/web` is an HTTP client independent from the business package. It uses
React Router, React Query, React Hook Form, Zod, and i18next.
`src/services/api.ts` centralizes UI transport contracts.

The client **MUST NOT** use domain entities as UI state models. HTTP dates are
serialized strings and errors are transport-specific.
