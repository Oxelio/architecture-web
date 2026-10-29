# Layers and boundaries

## Foundation and domains

`packages/shared/foundation` owns generic modeling primitives: aggregates, entities, identifiers, value objects, domain events and results. It has no business-context or infrastructure dependency.

`packages/contexts/iam/src/domain` owns accounts, login identities, password authenticators, email verification, sessions, password requirements, configuration invariants and pure recovery/MFA lifecycle predicates. The five existing roots remain separate and reference each other by identifier. Policy values are not loaded by entities or value objects.

Domain code must not import application contracts, HTTP, database, cache, configuration frameworks or cryptographic providers. UUID generation remains a generic identifier dependency. Passwords retain their original characters and are measured in Unicode code points.

## IAM application

`packages/contexts/iam/src/application` exposes intention-specific input/output contracts and use cases. Expected refusals are result values; unexpected technical exceptions propagate to the outer boundary.

Capabilities are `accounts`, `authentication` and `access-administration`. Readers, checks and outbound contracts live near their consumers. Shared aggregate repositories and transaction contracts remain explicit; there is no catch-all services directory.

`createIam` is the single public application composition entry point. It returns explicit `AccountsApplication`, `AuthenticationApplication` and `AdministrationApplication` interfaces through `accounts`, `authentication` and `administration`. It constructs use cases from supplied dependencies without runtime lookup. Password validation, factor verification, reauthentication, session issuance and configuration publication are shared within one application graph. The second-factor operation is connected to sign-in inside this factory; the API composition root supplies only the external ports and checks.

Application use cases perform domain transitions, select policies explicitly and call application-owned ports. They never receive Kysely transactions, Redis clients, SMTP clients or Node cryptographic implementations. See [IAM security](iam-security.md) for concrete responsibilities and transaction boundaries.

## Infrastructure

IAM adapters are packages under `packages/adapters/iam`. PostgreSQL adapters map aggregate roots and implement atomic recovery, MFA, configuration, export and deletion capabilities. Redis implements sessions and email-verification rate limiting. Hashing and verification/email providers implement their public application contracts.

`apps/api/src/adapters/iam` contains the selected Node crypto, QR, ZIP, account-mail and Audit integration adapters. This directory is infrastructure inside the application host, not HTTP orchestration.

Adapters must use public package exports. Database predicates and locks enforce the atomic capabilities requested by application contracts; they do not determine password policy or authorize a role supplied by HTTP.

## Messaging, Audit and Notifications

`packages/contexts/messaging` owns integration-event routing and outbox processing; its PostgreSQL adapter owns durable storage and claims. IAM PostgreSQL mutations append events using the transaction-bound outbox writer. Redis and provider calls remain separate consistency boundaries.

`packages/contexts/audit` owns audit contracts, redaction, consultation, export, retention and pseudonymization. Its integration handler subscribes to IAM/domain and security-operation events and receives a retention reader independent of IAM internals. Its PostgreSQL adapter remains separate from IAM persistence.

`packages/contexts/notifications` owns notification policies, recipients, preferences and delivery lifecycle. Its own application resolves mandatory/preferred channels and schedules deliveries. IAM emits facts rather than manipulating notification aggregates. Recipient directories and email/Slack/SMS providers are infrastructure adapters.

## HTTP and Web

`apps/api/src/composition-root` creates concrete dependencies, initializes configuration and wires the application graph. `features/iam` maps HTTP requests to application inputs, derives owned account identifiers from authenticated context, and presents results. Security HTTP routes follow the same application boundary as the other IAM endpoints.

The React application is an HTTP consumer. Its contracts use transport shapes and serialized dates, never domain objects as UI state. Client validation supports feedback; backend application validation remains authoritative.

ESLint presets enforce selected IAM and API boundaries. Public exports, TypeScript, tests and review remain necessary for constraints outside those static restrictions.
