# ADR-0011 — IAM owns recipient directory queries

**Status:** Accepted
**Content status:** Canonical
**Document type:** Architecture Decision Record
**Domain:** IAM / Notifications

## Context

The recipient directory used by Notifications currently queries IAM-owned
PostgreSQL tables directly. The adapter determines account existence,
verified email and active administrator status. Notifications owns its
directory port and the product rules that use these results.
[Work #112](https://github.com/Oxelio/architecture-web/issues/112) records
the [maintainer's acceptance and package retirement decision](https://github.com/Oxelio/architecture-web/issues/112#issuecomment-6793818924).

## Decision

IAM owns synchronous reads for account existence and verified normalized
email, active administrator IDs, and current active administrator status.
The recipient read returns only the account ID and verified normalized
email if present. An existing account can be found regardless of status.
Administrator selection and authorization require both the administrator
role and active status.

An adapter in API composition implements the Notifications directory port
through those IAM contracts. It maps results to Notifications types and
delegates affected-user delivery eligibility to the existing IAM contract
owned by [ADR-0010](0010-iam-erasure-evidence.md). Each lookup reads current
IAM state. Notifications and IAM remain independently importable.

After migrating the tracked consumers, retire
`@architecture/notifications-recipient-iam-kysely`. The API composition
adapter is the integration point.

## Alternatives and consequences

Keeping the existing adapter would retain direct knowledge of IAM storage
and duplicate its authorization predicates outside IAM. Keeping a separate
adapter package backed by IAM queries would retain a reusable package and
require coordinating its source contract. API composition keeps the
translation at the only tracked production integration point.

Notification selection, replay, delivery-time administrator authorization,
and erasure eligibility retain their approved behavior. The change requires
coordinated migration of the API and integration fixtures, with PostgreSQL
validation of missing and pending accounts, verified contact, role and
status changes, and affected-user eligibility.
