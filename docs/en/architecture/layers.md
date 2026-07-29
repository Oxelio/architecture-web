# Layers and boundaries

## Foundation

`packages/foundation` provides `Entity`, `Identifier`, `ValueObject`, `Result`,
and `ValueOf`. It contains no IAM-specific rule.

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

Static factories have different meanings: `create` builds new valid state and
applies defaults, while `rehydrate` restores already persisted state.

## IAM application

`packages/iam/core/application` exposes use cases, input/output contracts,
codes, and required ports. A use case orchestrates a business intent and
returns a `Result`.

This layer **MAY** depend on the domain, Foundation, and its own ports. It
**MUST NOT** depend on Kysely, Redis, Argon2, Nodemailer, Postmark, or Fastify
implementations.

Repositories and abstract services are secondary ports. `createIam` is
the application factory: it receives `IamDependencies` and returns the
`IamApplication` use-case set.

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

## Fastify API

`apps/api` is both the primary HTTP adapter and the composition root:

- `server.ts` configures Fastify, CORS, Swagger, authentication, and routes;
- `composition-root` creates PostgreSQL, Redis, and adapters, then calls
  `createIam`;
- `features/iam` groups controller, HTTP contract, presenter, and route
  options by feature;
- `routes` separates public, authenticated, and administrator endpoints.

Concrete implementations are allowed in `composition-root`, not in
controllers. Controllers **MUST** call use-case interfaces.

## React application

`apps/web` is an HTTP client independent from the business package. It uses
React Router, React Query, React Hook Form, Zod, and i18next.
`src/services/api.ts` centralizes UI transport contracts.

The client **MUST NOT** use domain entities as UI state models. HTTP dates are
serialized strings and errors are transport-specific.
