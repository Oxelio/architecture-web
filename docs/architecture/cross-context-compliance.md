# Cross-context compliance remediation

> **Document type:** Technical Design
>
> **Content status:** Approved Target

## Owners and authority

The maintainer accepted the cross-context remediation plan and its implementation
in the current review conversation. Canonical behavior remains owned by
[Notifications](../specifications/SF-NOTIFICATIONS-001.md),
[Audit](../specifications/SF-SECURITY-AUDIT-001.md) and
[Account data](../specifications/SF-ACCOUNT-DATA-001.md). Structural constraints
remain owned by [Dependency rules](dependency-rules.md) and accepted ADRs.
The adopted Method gitlink is `703051af50189a70399d82c82ca0f2b17c35f998`.

Source breaking changes and a fresh database target are explicitly authorized.
No old-format readers, compatibility facades or historical-data migration are
part of this scope. This does not authorize resetting an existing deployment.

## Delivery-time administrative authorization

The focused implementation context consists of the Notifications specification,
the [event reliability design](iam-events-reliability.md), Notifications core,
its persistence and IAM-directory adapters, API composition and the existing
PostgreSQL event integration suite. No additional aggregate is introduced.

Each accepted delivery records whether its selection was justified by the
affected-user audience, administrator audience, or both. These values are part of
the immutable first-consumption snapshot. A delivery justified only by the
administrator audience requires a current active-administrator check immediately
before every provider attempt. A delivery also justified by the affected-user
audience remains eligible on that basis; suspending an account must not prevent
its legitimate account notification.

The existing application-owned recipient directory supplies this check. Its IAM
adapter reads authoritative membership; exceptions remain technical failures.
A negative answer produces terminal `suppressed` with the minimized reason
`administrator_not_authorized`. A lookup exception follows bounded delivery retry
without calling the provider. Suppression is finalized with the existing token
and database-clock expiry predicate. It cannot rewrite acknowledgement, another
delivery, the original destination or event consumption.

Authorization is checked immediately before a send, not atomically with the
external provider or a concurrent IAM revocation. No distributed guarantee is
claimed. Replay never recreates a suppressed delivery.

Readiness: the functional authority, fresh-schema decision, contracts and
concurrency boundary are resolved for this scope. Unit tests cover selection,
permission loss, lookup failure, double audience and terminal transitions.
PostgreSQL tests cover persistence, replay and stale-owner finalization.

## HTTP Audit outcomes

HTTP successes remain `success`, 4xx rejections are `denied`, and 5xx responses
are `technical_failure`. Route templates remain mandatory; concrete bearer path
parameters must never re-enter the trail. This restores the existing approved
Audit outcome distinction without changing event selection.

## Audit collection, queries and deletion

The maintainer selected asynchronous post-deletion cleanup and successful
business responses despite lost Audit acceptance during implementation. The
functional owners above record these decisions. PostgreSQL business mutations
still fail atomically with their outbox append; this policy concerns direct
collection and facts following already successful Redis effects.

`AcceptAuditEntryUseCase` projects a versioned `audit.entry-accepted` envelope
into the existing outbox. Its consumer records the same identifier without
re-enqueueing. Sensitive keys are redacted and raw network addresses are replaced
with a fingerprint before acceptance. Failed acceptance reports only the event
identifier and loss, never input, credentials or provider error contents. No
success response asserts that a lost event was audited. Recovery attempt limits
use their own atomic, one-hour Redis window, independently of Audit projection.

`createAuditQueries` returns explicit personal and administrative contracts.
An application-owned access port resolves active membership and current
consultation policy. Personal queries and account exports return the minimal
approved projection. Both query types record consultation without copying
sensitive filters. Technical query failures propagate normally.

IAM no longer calls Audit inside the erasure transaction. Its existing deletion
fact triggers idempotent Audit cleanup after commit. Audit stores irreversible
actor/subject references alongside the live identifiers. Ingestion and cleanup
serialize by sorted reference locks. Cleanup clears only the deleted party's
direct identifier and replaces that party's references in metadata/context,
preserving other parties and non-sensitive facts. Concurrent and delayed facts
consult a privacy marker under the same lock and cannot restore the identifiers.

Markers contain only an irreversible reference and expiry, bounded by the
maximum supported 3650-day Audit retention horizon. Replay does not extend their
expiry. Expired facts cannot recreate purged evidence. An increase to the
supported maximum must coordinate this protection with the producer's retention
configuration. Legal holds preserve event evidence; pseudonymization still
removes direct identifiers.

## Retention execution

The existing non-overlapping process polling helper runs Audit purge hourly.
Multiple API instances may purge safely: each deletion checks expiry and absence
of legal hold in PostgreSQL. Errors reach the operational error logger; the next
hour retries. Shutdown awaits active purge before closing the shared database.
This guarantees scheduling while the API runs, not an external deployment or
availability SLA. Account deletion/export scheduling remains separate.

## Public contracts and workspace

Notifications persist `view_account`, not a Web URL; the Web resolves its route.
HTTP request/response schemas validate the Notifications surface. Production
composition uses Kysely's public `$pickTables` views; transaction-bound outbox
writers extend the known composition schema while retaining the same executor.
No `as never` or equivalent double cast remains in the corrected composition.

The context TypeScript baselines, negative boundary tests and source-resolving
Audit/Notifications test aliases protect the new contracts. IAM's effective
application aliases are also forbidden from its domain.
[ADR-0009](decisions/0009-grouped-workspace-topology.md) owns the accepted grouped
workspace; package identities and public exports still define its boundaries.
