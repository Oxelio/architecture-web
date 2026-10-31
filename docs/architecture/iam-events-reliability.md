# IAM event delivery reliability

> **Document type:** Technical Design
>
> **Content status:** Approved Target
>
> **Work:** [#60](https://github.com/Oxelio/Architecture-Web/issues/60)

## Authority and context

This bounded technical correction implements the maintainer-requested plan. It
preserves [ADR-0005](decisions/0005-domain-events-messaging.md), the
[dependency rules](dependency-rules.md), and the approved
[Audit](../specifications/SF-SECURITY-AUDIT-001.md) and
[Notifications](../specifications/SF-NOTIFICATIONS-001.md) behavior.
The adopted Method gitlink is `703051af50189a70399d82c82ca0f2b17c35f998`.
The implementation baseline is `938bfa28d4ba5d890daa8d47588a1b4ec9a2c223`.

## Processing ownership

Each PostgreSQL claim has a fresh UUID token, a database-clock timestamp and an
incremented attempt count. Claims expire after five minutes. A finalization
updates only a processing row with the expected token and an unexpired claim;
otherwise it returns false. Tokens belong to application processing contracts,
not business events. Workers claim one item immediately before processing it,
up to their existing per-run limit.

Abandoned claims consume attempts, follow the existing exponential backoff
(capped at one minute), and reach dead-letter after ten attempts. Successful
delivery remains at least once: a provider may accept a send whose response or
database finalization is lost. No external exactly-once guarantee is introduced.

Notification acknowledgement persistence and delivery finalization are separate
operations. A delivery worker cannot rewrite read/archive state or another
delivery. Existing source/recipient and delivery uniqueness constraints remain.

Polls cannot overlap within a process. Shutdown stops polling and awaits active
runs before closing PostgreSQL/Redis. Initialization failure closes created
resources. Provider network operations have explicit timeouts.

## Contract ownership

IAM application owns current integration topics, versions and explicit payload
projections, including application/security facts that have no aggregate
transition. Adapters retain transaction-bound append responsibility. Audit and
Notifications validate their subscribed current versions and required fields
before effects, without importing IAM internals or a global schema registry.
Session-started uses v2; other existing topics retain their current v1 contracts.
HTTP Audit metadata contains route templates, never concrete path parameters.

Source-contract replacements have no legacy facade. The maintainer explicitly
selected a fresh database target; no historic event/data migration or replay
compatibility is included. Future Audit retention is unchanged.

## Atomic Notifications consumption

Final review reproduced an additional delivery on PostgreSQL 18.4 at
`e8a2ec9a53b20e25824d22f08712f13ce0331ddf`: after an email delivery succeeded,
replaying the fact with a changed verified IAM address inserted a new pending
email while retaining one visible notification. Notification uniqueness alone
did not prevent this: the old create operation appended deliveries whose
uniqueness key included their mutable destination. Enabling an optional channel
or preference also added deliveries on replay.

The maintainer explicitly approved the complete first-successful-consumption
snapshot during final hardening on 2026-10-31 and requested its implementation
within this focused correction. The behavioral owner is the approved
[Notifications specification](../specifications/SF-NOTIFICATIONS-001.md#delivery-selection-and-replay).
This is a scoped functional clarification, not an inference from the former
uniqueness constraints or an approval of unrelated functional follow-ups.

Notifications resolves each recipient once per attempt and composes affected-user
and administrator channels before persistence. Its existing repository port
replaces single-notification `create` with `hasConsumedEvent` and atomic
`createForEvent(sourceEventId, notifications)`. The latter receives complete
notification aggregates, including an empty collection. All adapters and callers
must adopt this source-breaking contract; no compatibility facade remains.

The Notifications Kysely adapter owns a local `notification_consumptions` table
containing only the source-event UUID and database timestamp. In one transaction,
it inserts the unique consumption record with `ON CONFLICT DO NOTHING RETURNING`
and inserts the winning notification/delivery set. A concurrent loser writes
nothing; a failed winner rolls back the record and every effect, allowing retry
to select again. The application precheck avoids mutable lookups on replay but
does not replace this database concurrency boundary. Unexpected conflicts or
technical failures propagate rather than acknowledging a partial snapshot.

Existing notification/delivery constraints remain. Empty recipient and delivery
sets are durable consumption results, so later configuration or role changes do
not backfill an old fact. Read/archive operations and delivery finalization never
remove consumption records. Delivery claims, retries, ten-attempt exhaustion,
provider adapters and the outbox remain unchanged. Destinations are application
targets such as a verified email or logical Slack destination `security`, not
provider webhook credentials. The fresh-database target permits updating the
initial Notifications migration; there is no existing-data backfill or upgrade.

This local consumer boundary adds neither a generic inbox framework nor a
distributed transaction. A return on the former per-recipient conflict would
lose valid user/admin channel composition. A channel-only delivery key would
still allow newly enabled channels and recipients on replay and cannot record
an empty consumption result.

The existing delivery worker does not refresh IAM administrative membership
before sending an already queued alert. This correction does not establish
compliance with the specification's delivery-time authorization requirement;
that enforcement remains a separate functional/design follow-up. Snapshot
acceptance does not grant additional authorization.

## Unchanged limits and functional follow-ups

- PostgreSQL aggregate events are cleared during save. Current use cases do not
  retry the same detached aggregate after rollback; retries must reconstruct or
  reload state. No event lifecycle framework is added.
- Redis session save precedes PostgreSQL outbox append. Append failure rejects
  the call while the Redis session can remain; no compensation or best-effort
  success policy is introduced.
- Direct Audit failures can reject some operations after effects, including MFA
  sign-in. Changing this policy requires functional resolution.
- Revocation and final-deletion notification coverage, and delayed Audit facts
  after deletion pseudonymization, remain separate functional/design questions.

| Severity / evidence                                        | Remaining boundary and scenario                                                                                                                                                                                                                                                                                                                                                                                                                                      | Required follow-up                                                                                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High / source-traced risk, not reproduced in this Work     | [Deletion, line 214](../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-account-deletion.adapter.ts#L214) calls Audit pseudonymization before its own commit. A later failure can roll back deletion after Audit was changed; a delayed old fact can also append direct account references after pseudonymization has finished.                                                                                                                      | Resolve deletion/Audit ordering and retained-data semantics through their existing owners before selecting a cross-context correction. No new tombstone or deletion protocol is invented here. |
| Medium / confirmed sequence and tested failure contract    | [Session issuance, lines 32–36](../../packages/contexts/iam/src/application/authentication/issue-session.ts#L32) persists Redis first and then appends to PostgreSQL. An append failure rejects the operation while the session can remain.                                                                                                                                                                                                                          | ADR-0005 explicitly accepts the missing distributed transaction. A different success, compensation or publication policy needs functional authorization.                                       |
| Medium / confirmed source sequence                         | [MFA sign-in, line 69](../../packages/contexts/iam/src/application/authentication/complete-mfa-sign-in/complete-mfa-sign-in.use-case.ts#L69) awaits direct Audit after issuing the session. Audit failure can reject a partially completed operation, conflicting with the non-blocking functional objective.                                                                                                                                                        | Resolve the durable-acceptance/loss policy against the approved Audit specification before changing this result.                                                                               |
| Medium / confirmed coverage gap                            | [Revocation, line 42](../../packages/contexts/iam/src/application/authentication/revoke-current-user-session/revoke-current-user-session.use-case.ts#L42) has no integration publication; [notification policies, line 76](../../packages/contexts/notifications/src/application/policies/notification.policies.ts#L76) cover session start but not revocation or final deletion. Final deletion produces only a pseudonymous subject after the recipient is erased. | Specify the missing reactions and the final-deletion recipient/delivery policy. Do not infer an address or destination in a generic event.                                                     |
| Medium / confirmed preserved discrepancy                   | [HTTP Audit, line 23](../../apps/api/src/helpers/register-http-audit.ts#L23) retains the existing success/denied classification, including denied for HTTP 5xx.                                                                                                                                                                                                                                                                                                      | Restore the approved distinction for technical failures in a separately bounded correction; this Work explicitly preserves event selection/outcomes.                                           |
| Low / lifecycle risk, no current same-instance retry found | [Aggregate event extraction, line 21](../../packages/shared/foundation/src/domain/aggregate-root.ts#L21) clears events before commit. Reusing that rolled-back instance would omit its events.                                                                                                                                                                                                                                                                       | Discard/reload aggregates on failed transactions. No current use case retries the same instance; the rollback/fresh-retry integration test records this limit.                                 |

The credential-exclusion result covers the integration projections and HTTP
Audit route metadata. The separate [session credential/reference Work
#49](https://github.com/Oxelio/Architecture-Web/issues/49), including broader
session-management and logging surfaces, is not silently implemented here.

## Readiness and validation

Classification: Defect Correction / Technical Change, Complex, concurrency- and
security-sensitive with source breaking changes. Context owners and technical
decisions are resolved for this scope. The original correction established no
new product policy or durable structural rule; the later replay-selection
clarification is explicitly approved above. Work #60 owns operational scope. Project Status
cannot be read with the current connector; it remains unavailable and no
operational Ready/Done transition is inferred or recorded.

Technical readiness: READY WITH RISKS for the explicitly requested local
implementation. The non-blocking operational synchronization limitation above
must be resolved before recording a Project transition. Functional follow-ups
are excluded from implementation, not treated as accepted business decisions.
The Work is one bounded implementation unit; no delegation of implementation or
independent Task execution is needed. Security investigation/review is read-only.

Validate real PostgreSQL claim races, stale ownership, bounded retries, rollback,
partial consumer failure, replay/acknowledgement isolation, current/unsupported
contracts, secret exclusion, provider deadlines and worker lifecycle. Run the
workspace checks required by [Testing](../development/testing.md) for changed
public ports. Skipped integration tests do not establish database guarantees.

## Engineering review of the implementation candidate

Findings below were confirmed against the starting candidate. References point
to their corrected boundaries in this Work's implementation, not to an unchanged
vulnerable version. Git retains the original evidence.

| Severity | Finding and concrete failure                                                                                                                                  | Correction and preserved guarantee                                                                                                                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Outbox finalization filtered only by ID. A late failure could overwrite another worker's successful publication.                                              | [Outbox finalization, line 87](../../packages/adapters/messaging/persistence-kysely/src/kysely-outbox.adapter.ts#L87) requires the current unexpired token. Real PostgreSQL tests cover late failure/success in both orderings.                                                                                                                                                 |
| High     | Delivery save rewrote notification read/archive state and every delivery in its snapshot. A send could undo user acknowledgement or another channel's result. | [Notification persistence, lines 88 and 100](../../packages/adapters/notifications/persistence-kysely/src/kysely-notification.repository.adapter.ts#L100) separates state saves from fenced single-delivery finalization. Replay and individual/bulk acknowledgement are tested on PostgreSQL.                                                                                  |
| High     | Audit stored concrete URLs containing session bearer path parameters.                                                                                         | [HTTP Audit, line 38](../../apps/api/src/helpers/register-http-audit.ts#L38) stores the registered template or a constant unmatched marker. Encoded identifiers, encoded separators, unmatched paths and legitimate control requests are tested without changing event selection/outcomes.                                                                                      |
| Medium   | Consumers accepted arbitrary event versions, including a reproduced v999.                                                                                     | [Audit, line 36](../../packages/contexts/audit/src/application/events/audit-integration-event.handler.ts#L36) and [Notifications, line 28](../../packages/contexts/notifications/src/application/use-cases/notification-event-handler.use-case.ts#L28) reject incompatible subscribed versions and malformed required data before effects; current session v2 remains accepted. |
| Medium   | Polls overlapped; shutdown closed connections while workers could still use them. Later HTTP-plugin failure also leaked a constructed application.            | [Polling, line 2](../../apps/api/src/composition-root/background-polling.ts#L2), [application disposal, line 145](../../apps/api/src/composition-root/application.module.ts#L145) and [server startup, line 65](../../apps/api/src/server.ts#L65) explicitly await/close owned resources. Failure paths and preserved errors are tested.                                        |
| Medium   | Repeated expired claims never exhausted the retry budget.                                                                                                     | [Outbox recovery, line 119](../../packages/adapters/messaging/persistence-kysely/src/kysely-outbox.adapter.ts#L119) and [delivery recovery, line 171](../../packages/adapters/notifications/persistence-kysely/src/kysely-notification.repository.adapter.ts#L171) preserve the attempt budget; PostgreSQL tests reach dead-letter after ten abandoned attempts in each queue.  |
| Medium   | Persistence owned open-ended security topics, versions and payloads.                                                                                          | [IAM event projection, line 42](../../packages/contexts/iam/src/application/events/iam-security-event.ts#L42) owns closed fact inputs and field selection; adapters only supply technical IDs/time and append within their transactions.                                                                                                                                        |

Code Review found no remaining blocker in the implemented technical scope.
Architecture Review preserves the existing aggregate boundaries, inward
dependencies and transactional outbox. No new durable structural rule or ADR is
needed. Functional Compliance Review preserves the existing policies; it does
not claim completion of the excluded Audit/Notifications requirements above.

Simplifications implemented: removed the infrastructure-owned event helper,
unconditional queue saves and obsolete notification grouping for batch claims.
The two worker loops share only a small process-local polling lifecycle helper.
No additional scheduler, schema registry, event lifecycle framework or legacy
compatibility path is introduced. Further architectural consolidation is not
justified by the reviewed defects.

The trade-off of just-in-time claims is more short transactions per run, in
exchange for avoiding reservations that expire while waiting behind earlier
items. Attempt counts now mean started attempts, not only recorded failures.
Provider timeouts are configured and unit-checked; live SMTP/Slack/SMS carrier
delivery is not established by these tests.

## Local validation record

Agent-executed validation uses Windows, Node 24.15.0, pnpm 12.15.0, PostgreSQL
18.4 and Redis 8.8.1. The base commit is
`938bfa28d4ba5d890daa8d47588a1b4ec9a2c223`. This is an uncommitted local
candidate, not pre-merge evidence for an invented later commit. The sorted
changed-source manifest (53 TypeScript/JavaScript/JSON paths, including deletion
markers; documentation excluded) has SHA-256
`c57bd69551bfcea06e245d4e81927e379b1b8d0659e205fed096ee123feca9b6`.

- Workspace build, normal/test typechecks and lint passed. The final HTTP
  startup correction was additionally rechecked through API build/typecheck/lint
  and the complete API coverage suite. Lint retains existing delivery-tool and
  generated-coverage warnings, with no errors.
- The final `pnpm test` run passed 638 workspace tests and skipped only the 43
  opt-in database scenarios that passed separately below.
- The isolated API command running `iam-security.integration.spec.ts` and
  `iam-events.integration.spec.ts` passed all 43 scenarios, with no skips.
  Ordinary workspace runs skip these 43 cases when integration URLs are absent.
- `pnpm -r --workspace-concurrency=1 --if-present run test:coverage` passed for
  every package declaring that script. The final API suite passed 174 tests and
  skipped the 43 separately executed integration cases. Coverage is not a claim
  of complete functional acceptance or a new project-wide threshold.
- Markdown-link validation and its four controlled checker tests passed.
  Repository formatting and whitespace checks passed.

Earlier unsuccessful checks are not treated as evidence of success: initial
lint errors in changed files were corrected; a parallel validation run exceeded
the existing five-second Swagger test timeout and passed when rerun alone; the
first combined database run exposed unqualified migration-table discovery
across test schemas. Both fixtures now explicitly scope migration tables, and
the complete combined run passed. A startup-cleanup regression test failed
before the correction and passed afterwards. A development `.env` scanner
finding was explicitly exempted by the maintainer; its content was not printed.

The local technical assessment is that the confirmed reliability defects are
corrected and the design remains appropriately simple. Complete IAM event
functional compliance is not established: the explicit consistency and
functional follow-ups remain. No merge, operational Project state or Work Done
is inferred from these results.
