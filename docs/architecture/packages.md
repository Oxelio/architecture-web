# Packages and public APIs

## Package graph

```mermaid
flowchart LR
    foundation["@architecture/foundation"]
    iam["@architecture/iam"]
    messaging["@architecture/messaging"]
    messagingKysely["@architecture/messaging-persistence-kysely"]
    audit["@architecture/audit"]
    auditKysely["@architecture/audit-persistence-kysely"]
    notifications["@architecture/notifications"]
    notificationsInfra["Notifications infrastructure"]
    adapters["IAM adapters"]
    delivery["@architecture/delivery-automation (private)"]
    api["api (private)"]
    web["web (private)"]
    lint["@architecture/eslint-config"]

    iam --> foundation
    iam --> messaging
    audit --> messaging
    auditKysely --> audit
    notifications --> messaging
    messagingKysely --> messaging
    notificationsInfra --> notifications
    adapters --> iam
    api --> iam
    api --> adapters
    api --> audit
    api --> auditKysely
    api --> messagingKysely
    api --> notificationsInfra
    web -. HTTP .-> api
    api -. tooling .-> lint
    web -. tooling .-> lint
    iam -. tooling .-> lint
    delivery -. tooling .-> lint
```

Workspace packages are grouped under `packages/contexts/*`, `packages/adapters/*/*`, `packages/shared/*`, and `packages/tooling/*`. Domain/application layers remain below each context package's `src/`. Package names and exports remain the concrete boundary.

## Catalog

| Package                                              | Responsibility                        | Public API                                                                 |
| ---------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `@architecture/foundation`                           | generic domain primitives             | root export                                                                |
| `@architecture/iam`                                  | IAM domain and application            | `./domain`, `./application`                                                |
| `@architecture/messaging`                            | Messaging domain and application      | `./domain`, `./application`                                                |
| `@architecture/messaging-persistence-kysely`         | PostgreSQL outbox and migration       | root export                                                                |
| `@architecture/audit`                                | Audit domain and application          | `./domain`, `./application`                                                |
| `@architecture/audit-persistence-kysely`             | Audit PostgreSQL persistence          | root export                                                                |
| `@architecture/notifications`                        | Notifications domain and application  | `./domain`, `./application`                                                |
| `@architecture/notifications-persistence-kysely`     | Notifications PostgreSQL persistence  | root export                                                                |
| `@architecture/notifications-delivery-nodemailer`    | SMTP notification delivery            | root export                                                                |
| `@architecture/notifications-delivery-slack-webhook` | Slack webhook delivery                | root export                                                                |
| `@architecture/notifications-delivery-sms-webhook`   | SMS webhook delivery                  | root export                                                                |
| `@architecture/notifications-recipient-iam-kysely`   | IAM recipient directory               | root export                                                                |
| `@architecture/iam-persistence-kysely`               | IAM PostgreSQL schema and persistence | root export                                                                |
| `@architecture/iam-session-redis`                    | sessions and rate limiting            | root export                                                                |
| `@architecture/iam-password-argon2`                  | selected password hashing             | root export                                                                |
| `@architecture/iam-password-bcrypt`                  | alternative implementation            | root export                                                                |
| `@architecture/iam-email-verification-sha256`        | token hashing                         | `main`/`types`, no `exports` field                                         |
| `@architecture/iam-email-nodemailer`                 | selected SMTP delivery                | root export                                                                |
| `@architecture/iam-email-postmark`                   | alternative provider                  | root export                                                                |
| `@architecture/eslint-config`                        | shared ESLint configurations          | `.`, `node`, `react-vite`, `architecture`, `iam`, `api-boundaries`, `full` |
| `@architecture/delivery-automation`                  | repository delivery tooling           | private                                                                    |
| `api`                                                | server and composition                | private                                                                    |
| `web`                                                | React client                          | private                                                                    |

Each package manifest remains the source of truth. Bcrypt and Postmark adapters
are tested alternatives, but the current composition selects Argon2 and
Nodemailer. `@architecture/delivery-automation` is private repository tooling;
it is a workspace package but not a product/runtime public API.

## Ports and selected implementations

| Application port                 | Composed implementation                               |
| -------------------------------- | ----------------------------------------------------- |
| `UserRepository`                 | `KyselyUserAdapter`                                   |
| `EmailVerificationRepository`    | `KyselyEmailVerificationAdapter`                      |
| `SessionRepository`              | `RedisSessionAdapter`                                 |
| `EmailVerificationRateLimiter`   | `RedisEmailVerificationRateLimitAdapter`              |
| `PasswordHasher`                 | `Argon2PasswordHasherAdapter`                         |
| `EmailVerificationTokenHasher`   | `Sha256EmailVerificationTokenHasherAdapter`           |
| `VerificationEmailSender`        | `NodemailerEmailSenderAdapter`                        |
| `PasswordPolicyReader`           | `PublishedIamPolicies` or `FixedPasswordPolicyReader` |
| `ConfigurationStore`             | `KyselySecurityConfigurationAdapter`                  |
| `PasswordRecoveryStore`          | `KyselyPasswordRecoveryAdapter`                       |
| `MfaStore`                       | `KyselyMfaAdapter`                                    |
| `AccountExportStore`             | `KyselyAccountExportAdapter`                          |
| `AccountDeletionStore`           | `KyselyAccountDeletionAdapter`                        |
| `OutboxWriter`                   | `KyselyOutboxWriterAdapter`                           |
| `OutboxRepository`               | `KyselyOutboxRepositoryAdapter`                       |
| `AuditRepository`                | `KyselyAuditRepositoryAdapter`                        |
| `NotificationRepository`         | `KyselyNotificationRepositoryAdapter`                 |
| `NotificationRecipientDirectory` | `KyselyIamNotificationRecipientDirectoryAdapter`      |
| `NotificationDelivery` (email)   | `NodemailerNotificationDeliveryAdapter`               |
| `NotificationDelivery` (Slack)   | `SlackWebhookNotificationDeliveryAdapter`             |
| `NotificationDelivery` (SMS)     | `SmsWebhookNotificationDeliveryAdapter`               |

`BcryptPasswordHasherAdapter` and `PostmarkEmailSenderAdapter` also satisfy
`PasswordHasher` and `VerificationEmailSender`.

`UserQueryRepository.search` is the only user-collection read. It requires a bounded
page and page size, then returns the entity page and filtered total.
`getAdministrationOverview` provides global indicators separately.
`SessionRepository.findActiveForUser` remains unpaginated because
`SignInUseCase` limits an account to 10 active sessions.

## Persistence

PostgreSQL stores users, verifications, recoveries, MFA settings, backup codes,
challenges, audits, notifications, deliveries, the outbox, configuration
revisions, exports, and deletion requests. IAM Kysely migrations live in
`packages/adapters/iam/persistence-kysely/src/persistence/migrations`; Messaging, Audit,
and Notifications migrations live respectively in
`packages/adapters/messaging/persistence-kysely`, `packages/adapters/audit/persistence-kysely`, and
`packages/adapters/notifications/persistence-kysely`.
Redis stores expiring sessions, a per-user sorted set, and resend rate limits.

Application use cases own security orchestration; capability adapters own SQL and atomic operations. Audit owns its own persistence. See [IAM security](iam-security.md).

Schema, migrations, and mappers **MUST** evolve together. Rehydrated entities
**MUST** still satisfy their value objects; invalid persisted data must not be
silently normalized.

## Versioning and publication

Packages currently share version `1.0.0-alpha.1`, but the repository contains
neither Semantic Release configuration nor evidence of independent versioning.
Most publishable packages use `prepublishOnly` to build. Any stronger publication
or SemVer policy needs a human decision and an ADR.

## Authorized IAM contract migration

For the IAM correction, the maintainer explicitly authorized these replacements: `EmailSender` → `VerificationEmailSender`; `PasswordPolicyValidator` → `PasswordValidation` with an explicitly supplied policy; `SecondFactorGate` → `BeginSecondFactorUseCase` application contract; and `IamPolicyProvider`/`PasswordPolicyProvider` → narrow capability and operation-scoped readers. `IamActorRole`/`IamAccountIdentityPolicy`/`IamCapability` consumers must use the corresponding explicit role, account-policy and capability contracts rather than importing the removed universal provider vocabulary.

`createIam` callers now supply explicit account/session/password readers, second-factor handling and outbox dependencies; operation-aware account readers implement registration and sign-in projections. Adapter implementers must support conditional credential-use recording, identity replacement that preserves administration, and administrative-access queries through `UserQueryRepository`. The unit of work provides transaction-bound `userQueries`; `UserRepository` remains limited to account aggregate commands/loads. All in-repository implementations and doubles are migrated together. This is a targeted source-contract migration, not a new package publication or SemVer policy. Package identities and public subpaths remain unchanged.

MFA challenge creation additionally requires the expected account session generation, while status consultation keeps its original input. Fresh-authentication results carry that generation to the configuration commit guard. These are explicit application contracts; they do not expose credentials or introduce a persistence framework into the core.
