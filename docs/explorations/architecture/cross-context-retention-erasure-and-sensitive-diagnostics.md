# Work #107 — Cross-context retention, erasure, and sensitive diagnostics

**Working Exploration · Research / Discovery · Complex · Independent content review complete**

[Work #107](https://github.com/Oxelio/architecture-web/issues/107) covers O2, A2,
and O1. At the investigation baseline on 2026-11-07, the Issue was open,
unassigned, and in `Exploring` in the [Architecture Web Project](https://github.com/users/Oxelio/projects/3).
The active Method Role was Analyst. The source baseline was `main` at
`18b9ee07640daf17ccd772e04dbe4245b29d5e4d`, using the adopted Software
Engineering Method gitlink `703051af50189a70399d82c82ca0f2b17c35f998`.
The [current audit Exploration](cross-context-architecture-remediation.md) and
its [pinned historical version](https://github.com/Oxelio/architecture-web/blob/b420ae1a640f0fca59e3280633ca49d69356cd80/docs/explorations/architecture/cross-context-architecture-remediation.md)
have identical Git blob IDs. Both are investigation evidence.

The approved [Account Data](../../specifications/SF-ACCOUNT-DATA-001.md),
[Security Audit](../../specifications/SF-SECURITY-AUDIT-001.md), and
[Notifications](../../specifications/SF-NOTIFICATIONS-001.md) specifications own
product behavior. The [architecture principles](../../project/architecture-principles.md),
[overview](../../architecture/overview.md),
[dependency rules](../../architecture/dependency-rules.md), and
[ADRs 0004](../../architecture/decisions/0004-aggregates-and-consistency.md)
and [0005](../../architecture/decisions/0005-domain-events-messaging.md) govern
context and transaction boundaries. The
[cross-context compliance](../../architecture/cross-context-compliance.md) and
[IAM event reliability](../../architecture/iam-events-reliability.md) designs
explain earlier decisions within their own scope. This brief records evidence
and routes decisions to those authorities.

## O2 — Retention, erasure, and delayed delivery

**Conclusion.** IAM erasure and its deletion fact commit together. Audit
minimizes its own records asynchronously. A PostgreSQL probe reproduced a
notification accepted before erasure being sent to its saved destination by the
delivery worker after both IAM erasure and Audit cleanup. The same probe found a
published outbox envelope that still held the account identifier. Verified
cross-context completion therefore requires evidence beyond the IAM commit,
the deletion fact's published status, and Audit cleanup.

### Store and lifecycle evidence

| Boundary                                                   | Current behavior and disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Evidence and limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IAM request and cancellation                               | Strengthened verification precedes request persistence. IAM changes the account to pending deletion, advances session protection, and invalidates applicable authentication state. Redis session removal and the verified-address cancellation message follow the write. The request returns a scheduled time. The guarded cancellation restores the previous account status without restoring the revoked sessions.                                                                                                        | [Request use case](../../../packages/contexts/iam/src/application/accounts/request-account-deletion/request-account-deletion.use-case.ts), [cancellation use case](../../../packages/contexts/iam/src/application/accounts/cancel-account-deletion/cancel-account-deletion.use-case.ts), O2-T1. Physical Redis cleanup and logical session invalidation are separate observations.                                                                                                                                                                                                                                                                                            |
| IAM finalization and archives                              | The finalizer locks the pending account and the due request, respects the IAM hold flag, deletes the user and IAM children through foreign keys, and appends `account.deletion.executed` with a pseudonymous subject in the same transaction. IAM child records include identities, authenticators, security tokens, export archives and the request. The maintenance use case subsequently removes Redis sessions and expires archives.                                                                                    | [Finalizer](../../../packages/adapters/iam/persistence-kysely/src/adapters/kysely-account-deletion.adapter.ts), [security schema](../../../packages/adapters/iam/persistence-kysely/src/persistence/migrations/003_create_iam_security.ts), [maintenance](../../../packages/contexts/iam/src/application/accounts/maintain-iam-accounts/maintain-iam-accounts.use-case.ts), O2-T1. The protected [maintenance endpoint](../../../apps/api/src/features/iam/security/security.routes.ts) reports counts and may purge expired Audit rows. It supplies neither a per-account downstream acknowledgement nor evidence of a deployed scheduler.                                   |
| Audit projection, expiry, and holds                        | The deletion consumer removes direct account references and writes a bounded privacy marker. Append and removal serialize on subject-reference locks, and qualifying late facts consult the marker. Purge excludes held rows, and expired input cannot recreate purged evidence under the tested policy. A hold preserves evidence while account references can still be minimized.                                                                                                                                         | [Deletion consumer](../../../packages/contexts/audit/src/application/events/audit-integration-event.handler.ts), [Audit repository](../../../packages/adapters/audit/persistence-kysely/src/kysely-audit.repository.adapter.ts), O2-T2 and O2-P1. Audit acceptance captures retention in its envelope. IAM fact projection reads current policy when consumed. Neither result establishes what a deployed environment has configured or how it administers holds.                                                                                                                                                                                                             |
| Messaging outbox                                           | The envelope carries event ID, aggregate reference, payload, and context. IAM and Audit acceptance producers minimize particular fields, but older account-linked envelopes remain after the Audit projection is minimized. Finalization changes delivery state and diagnostics. No subject cleanup or terminal-row expiry was found in the inspected writer, worker, schema, or API composition.                                                                                                                           | [Outbox schema](../../../packages/adapters/messaging/persistence-kysely/src/migration.ts), [repository](../../../packages/adapters/messaging/persistence-kysely/src/kysely-outbox.adapter.ts), [IAM event projection](../../../packages/contexts/iam/src/application/events/iam-integration-event.ts), O2-P1. Deployed maintenance or external lifecycle controls remain unknown.                                                                                                                                                                                                                                                                                             |
| Notifications inbox, preferences, destinations, and replay | Inbox and preference rows use account identifiers with no IAM foreign key in this schema. Deliveries store the chosen destination and cascade from the inbox row. The source-event marker and the complete selection are written atomically. A consumed event cannot select again while its marker survives. A fresh, delayed event for an already missing account skips that affected-user selection. A previously accepted delivery uses its saved destination. The delivery-time check covers administrator-only claims. | [Schema](../../../packages/adapters/notifications/persistence-kysely/src/migration.ts), [intake](../../../packages/contexts/notifications/src/application/use-cases/notification-event-handler.use-case.ts), [recipient directory](../../../packages/adapters/notifications/recipient-iam-kysely/src/kysely-iam-notification-recipient-directory.adapter.ts), [delivery](../../../packages/contexts/notifications/src/application/use-cases/deliver-pending-notifications/deliver-pending-notifications.use-case.ts), O2-T3 and O2-P1. The approved rule about no final-deletion confirmation leaves the treatment of previously accepted messages to be resolved explicitly. |
| Provider, backup, and recovery copies                      | A provider call precedes local send finalization. A failed or expired finalization can leave a later attempt eligible, so local claim fencing alone cannot establish external deduplication. Backup retention, replay access, independent provider copies, and restore ordering require operational evidence.                                                                                                                                                                                                               | [Delivery use case](../../../packages/contexts/notifications/src/application/use-cases/deliver-pending-notifications/deliver-pending-notifications.use-case.ts), [delivery repository](../../../packages/adapters/notifications/persistence-kysely/src/kysely-notification.repository.adapter.ts). No live provider, log store, backup, or restore was exercised.                                                                                                                                                                                                                                                                                                             |

### Field-level retention evidence

The Account Data specification calls for final erasure of active identifiers
and technical data without a retention duty. The table distinguishes that
requirement from field-specific rules and gaps. Decision owners are roles to
confirm with the maintainer.

| Persisted field or data                                             | Owning context                                    | Approved requirement or policy gap                                                                                                                                  | Observed cleanup                                                                                                                  | Residual retention or replay risk                                                                                                             | Unresolved decision owner                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Account ID and active identifiers                                   | IAM                                               | Final erasure after the grace period, subject to documented retention obligations.                                                                                  | Finalizer deletes the account and cascades to IAM-owned children. Redis cleanup runs separately.                                  | The IAM cascade does not reach independent stores holding the same identifier.                                                                | Functional and privacy authorities for cross-context scope. Operations for evidence of residual session cleanup.                    |
| Direct actor and subject IDs, and pseudonymous references           | Audit                                             | Remove or pseudonymize direct account references. Required evidence may remain until expiry, subject to a documented hold.                                          | Async cleanup clears matching direct IDs and adds a bounded privacy marker. Purge removes expired, unheld evidence.               | Cleanup can lag or exhaust retries. An eligible late fact may retain a direct ID if its marker is lost in a restore.                          | Privacy or legal authority for hold and retention decisions. Operations for reconciliation and restore evidence.                    |
| Outbox aggregate reference, historical payload, and context         | Messaging                                         | The final-deletion fact is pseudonymous. No field-specific disposition for historical envelopes was identified.                                                     | Dispatch finalization changes delivery state. The inspected paths showed no account-driven scrubbing or terminal-row expiry.      | O2-P1 retained `payload.userId` after Audit cleanup. Recovery depends on which envelopes and deduplication records remain available together. | Privacy or legal authority for retention. Messaging and architecture owners for replay compatibility.                               |
| Inbox recipient ID and source-event ID, plus the consumption marker | Notifications                                     | Atomic recipient selection and stable replay are approved. No field-specific post-erasure disposition was identified.                                               | No IAM foreign key or account-driven inbox or marker cleanup was found. The marker prevents a consumed fact from selecting again. | Inbox rows remain account-linked. Losing the marker can permit a new selection or create a replay conflict.                                   | Functional and privacy authorities for inbox disposition. Notifications and operations owners for marker and recovery requirements. |
| Preference account ID, channel, and enabled flag                    | Notifications                                     | Preferences govern delivery selection. No field-specific post-erasure retention rule was identified.                                                                | No IAM foreign key or deletion-event cleanup was found in the inspected schema and consumer.                                      | Preferences can remain linked to an erased account. Their disposal must be evaluated separately from consumption markers.                     | Functional and privacy authorities for disposition. Notifications owner for the persistence boundary.                               |
| Saved delivery destination and delivery state                       | Notifications                                     | Replay preserves the selected destination. Final deletion sends no confirmation. The approved specification leaves preaccepted deliveries after erasure unresolved. | A delivery cascades if its inbox row is deleted. Claim and finalization preserve the saved destination.                           | O2-P1 reached the saved destination after erasure. Retained terminal rows and provider copies are separate risks.                             | Functional and privacy authorities for suppression and retention. Operations for external-copy evidence.                            |
| Persisted `last_error` on outbox and delivery rows                  | Messaging and Notifications, each for its own row | No approved field allowlist or diagnostic retention rule was identified for these columns.                                                                          | Later attempts can overwrite the text, and success clears it. No account-driven diagnostic cleanup was found.                     | Failed or dead-letter rows can keep account-linked or sensitive stringified text. O1-P1 reproduced the write with a synthetic canary.         | Privacy and security authorities for allowed data and retention. Operations for triage and replay needs.                            |

### Completion and recovery

1. **IAM erasure committed.** Observe the account deletion and its transactional
   outbox fact. The maintenance count is aggregate. Any remaining Redis keys
   and their cleanup require separate evidence.
2. **Audit cleanup observed.** Observe the Audit marker and minimized
   references. The router processes handlers in order and retries on error.
   Both workers fence finalization and cap retries at ten attempts. An outage,
   partial dispatch, or exhausted outbox row can leave the deletion committed
   with Audit cleanup outstanding. An outbox terminal state alone does not
   locate the last completed side effect. [Router](../../../packages/contexts/messaging/src/application/services/integration-event-router.ts)
3. **Cross-context completion verified.** Define the required disposition and
   proof for each remaining store before making a user-facing completion claim.
   No per-account reconciliation, completion record, or supported dead-letter
   replay procedure was identified in the inspected production paths.
   Restoration or loss of an Audit marker could admit a still-eligible old
   fact without its normal privacy protection. Losing a Notifications marker
   could permit selection against then-current IAM state. An existing conflicting
   row can also block a partial replay. These are recovery scenarios, with no
   approved restoration guarantee established by this brief.

The API wires non-overlapping outbox and delivery polling and hourly Audit
purge while the process runs. The GitHub environment and recent deployment
metadata available to this investigation concern delivery-control workflows.
The deployed IAM scheduler, queue and hold monitoring, operator replay
procedure, provider behavior, and backup or restore controls remain unverified.
[API composition](../../../apps/api/src/composition-root/application.module.ts)

**Decision and follow-up.** The human functional authority should resolve
whether to suppress or remove previously accepted affected-user deliveries and
what the user can be told at each milestone. The accountable privacy or legal
authority should establish which outbox, inbox, preference, delivery, and
external copies may remain, including hold and backup treatment. Operations
should establish scheduler and recovery evidence and own any runbook or
reconciliation follow-up. The project architecture authority should review any
new cross-context cleanup or completion contract. Recommend separate Work for
the reproduced delivery case once intended behavior is resolved, and separate
retention or recovery Work where store policy or operational evidence warrants
it. Any historical cleanup needs its own authorization.

## A2 — Ownership of Audit network fingerprints

**Conclusion.** The persistence fallback is callable through a direct Audit
append with raw IP input. The current in-repository production call graph has
no such caller. This is a dormant fallback in the observed composition. A
boundary change still needs a supported-consumer and correlation decision.

| Evidence ID | Current production path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A2-S1**   | HTTP and security request contexts can carry `request.ip`. `AuditSecurityEventsAdapter.record` delegates to `AcceptAuditEntryUseCase`, which strips raw IP, hashes a truthy raw string through the injected SHA-256 adapter, and appends an Audit acceptance envelope. Consultation recording uses the same acceptance operation. The accepted-event handler allowlists `networkFingerprint` and excludes `ipAddress` when calling Audit append. [HTTP capture](../../../apps/api/src/helpers/register-http-audit.ts) · [Security bridge](../../../apps/api/src/adapters/iam/audit-security-events.adapter.ts) · [Acceptance and replay](../../../packages/contexts/audit/src/application/accept-audit-entry.use-case.ts)                                                                                                                                                     |
| **A2-S2**   | The other append path is the IAM integration-event handler. It reconstructs a narrow actor and subject context with neither network input. The API's other uses of the concrete Audit application are export and purge. A focused call-site search covered 357 non-test TypeScript files across API and the four affected contexts and persistence paths. External consumers, custom composition, and historical data were outside that evidence. [IAM handler](../../../packages/contexts/audit/src/application/events/audit-integration-event.handler.ts) · [Audit application](https://github.com/Oxelio/architecture-web/blob/e51717ab540b197f21acfd7cf3c5e03e4007eab7/packages/contexts/audit/src/application/services/audit.application.ts) · [API composition](../../../apps/api/src/composition-root/application.module.ts)                                           |
| **A2-S3**   | Persistence computes a Web Crypto SHA-256 digest whenever raw IP is truthy, then stores `networkFingerprint ?? digest`. At acceptance, raw input instead wins over an already supplied fingerprint when both are present. Both hashing paths use exact string bytes and introduce no IP canonicalization. The API proxy-trust setting can affect the input upstream. The stored fingerprint is absent from the inspected Audit read mapper and filters. No current read or correlation consumer was identified. [SHA-256 adapter](../../../apps/api/src/adapters/audit/sha256-audit-pseudonymizer.adapter.ts) · [Audit persistence](../../../packages/adapters/audit/persistence-kysely/src/kysely-audit.repository.adapter.ts) · [Read mapper](../../../packages/adapters/audit/persistence-kysely/src/audit-entry.mapper.ts) · [API setup](../../../apps/api/src/server.ts) |

The digests agree for identical nonempty raw input under the current adapter.
Different string representations can yield different fingerprints for the same
address. Unkeyed deterministic hashing allows candidate testing over enumerable
address ranges and links repeated input. Treat the digest as pseudonymous data.
The same application port also supports account reference hashing. A blanket
change to its implementation could break the equality used by IAM deletion facts,
Audit subject references, and existing privacy markers.

**Decision and follow-up.** The architecture authority should confirm supported
callers and choose whether to remove the dormant fallback, preserve a supported
compatibility path, or clarify the boundary without code changes. Security and
privacy authorities should first establish required correlation, attacker
assumptions, and permitted linkage. If a policy change is warranted, operations
should assess custody, rotation, historical correlation, and mixed-version
behavior. Coordinate any boundary proposal with [Work #110](https://github.com/Oxelio/architecture-web/issues/110).
Historical migration and cryptographic policy require separate decisions.

## O1 — Sensitive technical diagnostics

**Conclusion.** Source and a synthetic probe show two different disclosure
surfaces. The Messaging logger receives the original error object. Both stores
can persist sensitive material embedded in the error's string representation.
No operational disclosure was established.

| Evidence ID       | Surface                                  | Verified behavior and limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O1-S1 / O1-P1** | Error object passed to the logger        | Outbox dispatch logs an object carrying the original thrown value and event ID. The default production wiring is the console. The probe's injected logger received the same object, including its nested cause and response property. The API also logs raw errors escaping polling callbacks. Sink serialization, access, export, and retention remain unverified. [Outbox worker](../../../packages/contexts/messaging/src/application/services/outbox-worker.ts) · [Polling wiring](../../../apps/api/src/composition-root/application.module.ts)                                                                                                                                                                                                                                                                                     |
| **O1-S2 / O1-P1** | Stringification and persisted error text | Outbox and Notifications use `String(error).slice(0, 2_000)` and Kysely writes `last_error` on fenced finalization. In the probe, both failed rows stored the ordinary Error message canary. Neither row contained the nested cause or response canaries. A custom stringifier or an upstream error with sensitive material in its message could still put it into the row. Truncation only bounds length. [Outbox entity](../../../packages/contexts/messaging/src/domain/entities/outbox-message.entity.ts) · [Delivery entity](../../../packages/contexts/notifications/src/domain/entities/notification-delivery.entity.ts) · [Delivery persistence](../../../packages/adapters/notifications/persistence-kysely/src/kysely-notification.repository.adapter.ts)                                                                      |
| **O1-S3**         | Provider-specific paths                  | Nodemailer exceptions can propagate into the delivery catch. The Slack and SMS adapters construct status-only errors for non-success HTTP responses. Transport failures still propagate, and the delivery worker ordinarily persists a provider failure without logging it directly. Claim, recovery, or finalization failures can escape to API polling. No live SMTP, webhook, collector, or production failure row was inspected. [Email adapter](../../../packages/adapters/notifications/delivery-nodemailer/src/nodemailer-notification-delivery.adapter.ts) · [Slack adapter](../../../packages/adapters/notifications/delivery-slack-webhook/src/slack-webhook-notification-delivery.adapter.ts) · [SMS adapter](../../../packages/adapters/notifications/delivery-sms-webhook/src/sms-webhook-notification-delivery.adapter.ts) |

**Decision and follow-up.** Recommend separately scoped diagnostic hardening
after privacy and security owners define permitted fields, access, and handling
of old diagnostics. Operations should identify what actually drives triage or
replay, including any parser of current text. Compare stable error categories
and allowlisted correlation metadata with sink-specific sanitization or a
separately controlled diagnostic channel. Preserve retry classification, backoff,
terminal states and claim semantics. Route independently corroborated exposure
to the accountable security owner for incident assessment. The synthetic
canaries demonstrate reachability and persistence only.

## Verification and independent review

| Evidence                                      | Result and scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build and focused unit tests**              | API and its workspace dependencies built from the baseline with `pnpm --filter 'api^...' --if-present build`. Vitest ran 46 passing tests in eight files. Filters were Audit `accept-audit-entry audit-integration-event.handler`, Messaging `outbox-worker outbox-message.entity`, Notifications `deliver-pending-notifications notification-delivery.entity`, and API `background-polling register-http-audit`.                                                                                                                                                                                                                      |
| **O2-T1–T3 — Existing isolated integration**  | 11 passed and 59 were excluded by the name filter. T1 covered single-use cancellation, rejection of stale Redis sessions, IAM legal hold, transactional rollback on outbox failure, and idempotent erasure. T2 covered concurrent and delayed facts, Audit expiry and holds, and no resurrection of expired evidence. T3 covered replay after an address change, durable empty selection, stale delivery ownership, terminal failures, and partial dispatch. [Security suite](../../../apps/api/src/adapters/iam/iam-security.integration.spec.ts) · [Events suite](../../../apps/api/src/adapters/iam/iam-events.integration.spec.ts) |
| **A2-S1–S3 — Caller and contract inspection** | Traced current composition, input shaping, writes and query projection. Audit acceptance and integration-handler unit tests passed. A direct persistence probe would only demonstrate the dormant callable branch and would add no production reachability evidence.                                                                                                                                                                                                                                                                                                                                                                   |

### Reproducing O2-P1 and O1-P1

Use the source baseline above and the
[IAM events integration fixture](../../../apps/api/src/adapters/iam/iam-events.integration.spec.ts).
The probes ran in an isolated Vitest spec with Node 24.19.0, pnpm 12.15.0,
Vitest 4.1.10, PostgreSQL 18.4, and Redis 8.8.1. Follow the documented
[disposable setup](../../development/testing.md#isolated-iam-postgresqlredis-integration)
with both integration URLs set. Reuse the suite's generated schema,
migrations, repository setup, and between-case cleanup. Build the API and
workspace dependencies first. The original investigation ran
`pnpm --filter api test src/adapters/iam/work-107-discovery.local.spec.ts --reporter=verbose`
from the repository root.
The temporary spec and fixture services were removed after both probes passed.
The command cannot be run directly from the current checkout because the spec
file is absent.

#### O2-P1 — A delivery accepted before erasure

Seed one active synthetic user with a verified `example.test` email. Create
an `iam.user-password-changed` v1 event with a new ID, a current timestamp,
the user as aggregate, actor, and subject, `actorType: "user"`, and
`payload.userId`. Wire the real outbox, Audit, and
Notifications repositories, the IAM recipient directory, and a stub email
adapter. Dispatch through the real router with the IAM Audit handler and
Notifications intake. Use a fixed 30-day Audit value for this test fixture.

| Step                                                                                                                                                                                                                                                                                                                   | Expected assertion from the source trace                                                                                                                       | Observed in the isolated run                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Append the fact and drain the outbox.                                                                                                                                                                                                                                                                                  | Intake records consumption and one pending `affected_user` email delivery. Capture its stored destination.                                                     | One pending delivery and its marker were present.                                                       |
| Set the user to `pending_deletion`. Seed a request with previous status `active`, a synthetic cancellation hash, and a due time just before the test clock. Leave hold, cancellation, and execution unset. Call `KyselyAccountDeletionAdapter.eraseIfDue` with a transaction-bound outbox writer before another drain. | Finalization returns the user ID and the directory no longer finds the recipient. The existing Audit row still has its direct `subject_id`.                    | All three assertions passed before downstream processing.                                               |
| Drain the deletion fact. Query the original rows by event ID.                                                                                                                                                                                                                                                          | The prior Audit row has a null `subject_id`. The original `messaging_outbox` row is still `published` and `payload.userId` still equals the erased account ID. | Audit minimized the row and the published envelope retained the identifier.                             |
| Submit the original fact to Notifications intake again, then submit the same fact with a new event ID.                                                                                                                                                                                                                 | The replay makes no new selection. The fresh late fact records consumption without an affected-user delivery. The inbox and delivery counts stay at one.       | The fresh event had a consumption marker, and no second inbox or delivery row appeared.                 |
| Run `DeliverPendingNotificationsUseCase`.                                                                                                                                                                                                                                                                              | The existing claim reaches the stub once with the exact saved destination, and the row becomes `sent`.                                                         | The stub was invoked once with the saved destination after both cleanup stages, and the row was `sent`. |

The probe seeds the due state to isolate finalization and downstream behavior.
O2-T1 covers the existing request and cancellation boundaries. The stub
establishes a send attempt at the adapter boundary. Production delivery,
restore behavior, and provider-side retention remain unverified.

#### O1-P1 — Error object and persisted diagnostic text

Start from a clean fixture schema with a fresh password-change fact. Create
one ordinary `Error` with message `synthetic-message-canary`, an Error cause
with message `synthetic-cause-canary`, and an enumerable `response.detail`
with value `synthetic-response-canary`. Use the same Error instance in both
failure paths.

| Step                                                                                                                                                                                                | Expected assertion from the source trace                                                                                                                                  | Observed in the isolated run                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Append the fact and drain with a dispatcher that throws the Error and a spy logger. Read `messaging_outbox.status` and `last_error`.                                                                | The logger receives the original Error object, including the nested cause and response. The row is `failed` with `last_error` equal to `Error: synthetic-message-canary`. | Object identity, both nested fields, and the exact persisted string matched. |
| Seed a verified synthetic recipient for that fact. Run Notifications intake and delivery with an email adapter that rejects with the Error. Read `notification_deliveries.status` and `last_error`. | The stub runs once. The row is `failed` with the same exact string, which excludes the cause and response canaries.                                                       | The call count, failure state, and stored text matched.                      |

This probe verifies the logger argument and database values. Production
console rendering, collectors, log access, retention, and disclosure remain
unverified.

### Existing integration selection

With the same fixture running and both integration URLs set, rerun the
existing integration selection from the repository root.

```powershell
$selection = @(
  'honors legal hold and executes final deletion'
  'cancels a deletion once'
  'rejects a stale Redis session'
  'prevents concurrent or delayed facts'
  'purges expired evidence'
  'replayed after a verified address change'
  'empty recipient selection'
  'expired delivery owner'
  'dead-letters ten abandoned'
  'replays partial Audit/Notifications'
) -join '|'
pnpm --filter api test src/adapters/iam/iam-events.integration.spec.ts src/adapters/iam/iam-security.integration.spec.ts -t $selection
```

The maintainer should identify the named functional, privacy or legal,
security, architecture, and operations authorities before any of the proposed
follow-up scopes are authorized. The favorable independent content review
covered the evidence and its limits, especially the distinction between an accepted delivery and a
replayed fact, between an available fallback and a production caller, and
between a reachable diagnostic sink and an observed disclosure. The brief
remains a non-normative Exploration, and its recommendations are proposals.

## Publication and Work Merge Gate

The brief was prepared on `codex/work-107-discovery` while Work #107 was in
`Exploring`. Publication planning considered the following two routes.

- **Publish under Work #107.** Use one Work Integration PR to `main` with
  `Refs #107` if a valid, explicitly selected Workflow Route permits
  `Exploring` → `Reviewing` → `Validating`. Each transition requires the
  relevant activities and applicable gate results, including accepted review
  before entering `Validating` under the normal Quality Gate. Authorization
  to investigate and favorable review feedback do not automatically authorize
  these transitions. A permitted coordinator records each transition only
  once its conditions are established. [Lifecycle transition rule](../../../external/software-engineering-method/lifecycle.md#5-transition-rule)
- **Publish under separately authorized documentation Work.** If #107 stays on
  its discovery route, a documentation publication Work can own the PR and
  reach `Validating` through its own applicable route and gates. The original
  audit Exploration used this approach. [Work #116](https://github.com/Oxelio/architecture-web/issues/116) · [PR #117](https://github.com/Oxelio/architecture-web/pull/117)

Either option requires a PR to `main`, candidate-bound validation, applicable
review and authority results, repository-required checks, and a passing Work
Merge Gate while the PR's owning Work is in `Validating`. Integration requires
its own authorization. Any later closure is a separate evidence decision.
[Delivery profile](../../project/delivery-pipeline.md#work-merge-gate)
