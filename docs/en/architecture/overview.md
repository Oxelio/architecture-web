# Architecture overview

## Project purpose

Architecture Web is a reference identity-management application: sign-up,
sign-in, email verification, profile, administration, sessions, recovery, MFA,
auditing, export, and account deletion. The historical IAM core keeps its rules
independent from Fastify, React, PostgreSQL, Redis, and email providers. The
newer security vertical is orchestrated in the API and is a documented
exception to this separation.

The repository uses a modular architecture inspired by ports and adapters. No
dependency-injection framework is used: implementations are assembled
explicitly inside the API.

The bounded context is named **IAM** (`Identity and Access Management`). Its
core is split into three internal capabilities:

- `accounts`: account, email address, verification, and password;
- `authentication`: sign-in, resolution, and personal sessions;
- `access-administration`: paginated consultation, global indicators, roles,
  lifecycle, and administered sessions.

`apps/api/src/security` adds recovery, MFA, audit, configuration, export, and
deletion across those capabilities. Account status (`active`, `suspended`, or
`pending_deletion`) remains independent from email verification.

## Monorepo map

```text
apps/
├── api/                         HTTP interface and composition
└── web/                         React interface
packages/
├── foundation/                  modelling primitives
├── eslint-config/               shared ESLint rules
└── iam/
    ├── core/                    domain + application
    └── infrastructure/
        ├── email/               Nodemailer and Postmark
        ├── persitence/kysely/   PostgreSQL through Kysely
        ├── security/            Argon2, bcrypt, and SHA-256
        └── session/redis/       sessions and rate limiting
```

The `persitence` directory contains a historical spelling error, while the
published package is correctly named
`@architecture/iam-persistence-kysely`. Documentation uses the real path
when linking to code.

## Main flow

```mermaid
flowchart LR
    Browser[React application] -->|HTTP JSON + sid cookie| API[Fastify API]
    API -->|application contract| UC[IAM use cases]
    UC --> Domain[Entities and value objects]
    UC --> Ports[Application ports]
    Kysely[Kysely adapter] -. implements .-> Ports
    Redis[Redis adapter] -. implements .-> Ports
    Crypto[Hashing adapters] -. implements .-> Ports
    Mail[Email adapters] -. implements .-> Ports
    API -->|composes| Kysely
    API -->|composes| Redis
    API -->|composes| Crypto
    API -->|composes| Mail
    API --> Security[hybrid SecurityService]
    Security -->|direct queries| Kysely
    Security --> Redis
    Security -. implements .-> Gate[SecondFactorGate]
    UC --> Gate
```

A request reaches a Fastify route. The controller maps HTTP data to a use-case
input. The use case validates and orchestrates the domain and calls ports only.
Technical adapters implement those ports. A presenter maps the application
`Result` to an HTTP status and body. Routes under `apps/api/src/security` use a
second path: they call `SecurityService` directly, and that service uses Kysely
and maps `SecurityError` at the HTTP boundary.

## Intended properties

- IAM rules remain testable without network or database access.
- A technical provider can be replaced at the composition point.
- Business and HTTP contracts are explicit and evolve separately.
- The domain controls the creation and validity of its values.
- Expected errors are typed values; unexpected failures remain exceptions
  handled at the HTTP boundary.

## Aggregates and consistency

Foundation defines `AggregateRoot` as a semantic specialization of `Entity`.
The IAM bounded context declares three single-entity aggregates:

- `UserEntity` for identity, credentials, role, and status;
- `SessionEntity` for the lifecycle of a Redis session;
- `EmailVerificationEntity` for a verification token and its state.

Aggregates reference each other by identifier and are not loaded as a `User`
object graph. Commands that change `UserEntity` and
`EmailVerificationEntity` in PostgreSQL use `IamUnitOfWork`, implemented by a
Kysely transaction. Session creation and enforcement of the per-user limit are
atomic in Redis.

The code still defines no event bus, domain events, or separate domain
services. Email is sent after the PostgreSQL commit, but there is no durable
outbox yet to retry it after an SMTP failure.

## Observed trade-offs

- `packages/iam/core` contains domain and application in one package, with
  separate public subpath exports.
- The API depends on both core and adapters. This is intentional in the
  composition root, where concrete details must be known.
- HTTP contracts (`*.http.ts`, `*.route-options.ts`) are separate from
  application contracts (`*.contracts.ts`). This adds files but prevents HTTP
  from becoming the business contract.
- Architecture ESLint rules are currently warnings limited to parent imports.
  Some boundaries therefore rely on documented convention and review.
- `SecurityService` mixes application orchestration and technical access inside
  `apps/api`. No ADR establishes whether this exception is durable.
- The configuration catalog contains represented but unused options. The
  [security guide](../guides/account-security.md) separates effective settings
  from visible-only settings.
