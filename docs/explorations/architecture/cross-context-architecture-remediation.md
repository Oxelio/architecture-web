# Exploration — Cross-context architecture remediation

**Artifact status:** Working
**Content status:** Hypothesis
**Document type:** Exploration
**Domain:** Architecture

The maintainer accepted the audit as an evidence-based assessment and approved
the eight scopes as a planning baseline. The findings below distinguish observed
behavior from proposed changes. Each GitHub Work owns its operational state.
The planning baseline does not confer implementation, contract removal,
structural, functional, or migration authority.

## Baseline and evidence

- Audited local and GitHub `main` at
  [`173718dbff48dfe1143381a735a613301319a85e`](https://github.com/Oxelio/Architecture-Web/commit/173718dbff48dfe1143381a735a613301319a85e).
  The checked-out Method matched gitlink
  `703051af50189a70399d82c82ca0f2b17c35f998`.
- [PR #87](https://github.com/Oxelio/Architecture-Web/pull/87) is effective.
  Preserve its delivery-time authorization, minimal Audit projections, durable
  acceptance, deletion serialization, and retention behavior.
- The TypeScript AST inventory covered 509 tracked TypeScript files and 2,195
  literal import and export references. The existing ESLint boundary suite
  passed 19 tests and the Notifications HTTP suite passed 6. Additional in-memory
  probes exposed gaps despite the passing suites. The audit did not rerun the full
  workspace or PostgreSQL/Redis integration suite.

Authoritative sources include the [Project Method Profile](../../project/project-method-profile.md),
[architecture principles](../../project/architecture-principles.md),
[dependency rules](../../architecture/dependency-rules.md),
[package contracts](../../architecture/packages.md), and
[delivery policy](../../project/delivery-pipeline.md). ADRs
[0004](../../architecture/decisions/0004-aggregates-and-consistency.md),
[0005](../../architecture/decisions/0005-domain-events-messaging.md),
[0006](../../architecture/decisions/0006-iam-account-identities-and-authenticators.md),
and [0009](../../architecture/decisions/0009-grouped-workspace-topology.md)
establish the relevant structural constraints.

## Context comparison

| Context       | Observed responsibilities and composition                                                                                                                      | Justified differences                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IAM           | Capability contracts for accounts, authentication, and administration. The API uses `createIam` and assembles Kysely, Redis, and provider adapters.            | Capability grouping reflects IAM's size and vocabulary. Transaction-bound publication and the PostgreSQL–Redis consistency boundary remain meaningful.         |
| Audit         | Durable acceptance, evidence projection, authorized consultation, minimal export, deletion cleanup, and retention. Kysely serializes append and deletion.      | Acceptance and projection have distinct failure guarantees. Keep the append-oriented model and context-owned privacy policies.                                 |
| Messaging     | Outbox state transitions, a claim and retry worker, and ordered dispatch through an event router. The API composes the collaborators directly.                 | A writer and a worker repository serve different responsibilities. A factory or common business use-case shape would add indirection.                          |
| Notifications | Inbox, preferences, event intake, recipient selection, and channel delivery. The API uses `createNotifications` and selects provider and persistence adapters. | Atomic recipient snapshots and fenced claims have different persistence semantics from ordinary aggregate saves. The factory already exposes typed operations. |

All four context packages expose `./application` and `./domain`. The production
import inventory did not find a core importing another context's private model
or a concrete infrastructure package. Public Messaging contracts and manual API
composition explain the cross-context edges observed. Both interfaces and
abstract classes can express ports. The distinction alone does not warrant a
contract change.

## Discrepancy register

| Finding | Evidence and classification                                                                                                                                                                                                                                                                                                                                                                                                                                      | Disposition                                                                                                                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N1**  | Confirmed account-isolation defect in the Notifications HTTP list boundary. A synthetic two-account probe demonstrated that a caller could affect which account was selected. The approved [Notifications specification](../../specifications/SF-NOTIFICATIONS-001.md) requires account isolation. The exact trigger and reproduction are held privately while the defect is unfixed.                                                                            | Work 1. Prove the authenticated owner remains authoritative without changing the pagination or response contract.                                                                                                                                                            |
| **E1**  | Ten forbidden imports passed probes against the effective ESLint presets. Examples included foreign-context inner-layer imports and transport-to-adapter imports. The SHA-256 adapter inherited the root preset. These were enforcement gaps rather than observed production edges. See the [context preset](../../../packages/tooling/eslint-config/context.mjs) and [API preset](../../../packages/tooling/eslint-config/api-boundaries.mjs).                  | Work 3. Extend existing rules and test both forbidden and allowed edges.                                                                                                                                                                                                     |
| **E2**  | TypeScript config probes found 42 test files among production inputs: 18 in three contexts and 24 in adapters. IAM excludes its spec files. Four Notifications adapters lack separate test typechecking. Some packages also lack stricter compiler checks present in IAM. Compare the [IAM build config](../../../packages/contexts/iam/tsconfig.json) and [Messaging build config](../../../packages/contexts/messaging/tsconfig.json).                         | Work 3. Separate test compilation and address the side-effect import check. Leave unrelated config differences.                                                                                                                                                              |
| **E3**  | Node resolved the SHA-256 adapter's documented root and its incidental `dist/index.js` deep path because the [manifest](../../../packages/adapters/iam/email-verification-sha256/package.json) has no exports map. The only tracked production caller imports the root. Messaging and Notifications already enforce their declared subpaths.                                                                                                                     | Work 4. Confirm the supported consumer boundary and obtain approval before closing deep paths.                                                                                                                                                                               |
| **A1**  | The [Audit application class](../../../packages/contexts/audit/src/application/services/audit.application.ts) exposes append, export, purge, and account-reference removal. It reaches consumers needing only one capability. The [acceptance operation](../../../packages/contexts/audit/src/application/accept-audit-entry.use-case.ts) also uses the name `record` despite its distinct loss policy.                                                          | Work 5. Prefer explicit capability contracts and direct composition. Preserve consultation and failure behavior. Migrate actual consumers together if contract removal is approved.                                                                                          |
| **A2**  | The acceptance operation uses an injected pseudonymizer. The [Audit persistence adapter](../../../packages/adapters/audit/persistence-kysely/src/kysely-audit.repository.adapter.ts) also hashes a raw IP as a fallback and gives a supplied fingerprint precedence.                                                                                                                                                                                             | Work 2. Investigate ownership and callers. Preserve existing precedence and historical correlation pending a separate decision.                                                                                                                                              |
| **N2**  | [Notifications outbound contracts](../../../packages/contexts/notifications/src/application/index.ts) are located under `services`, and the Messaging event handler sits with ordinary use cases. Their runtime and package contracts already express meaningful boundaries.                                                                                                                                                                                     | Work 6. Organize inbox, preferences, intake, delivery, and outbound ports. Preserve the factory shape and public operations.                                                                                                                                                 |
| **N3**  | The documented [recipient bridge](../../../packages/adapters/notifications/recipient-iam-kysely/src/kysely-iam-notification-recipient-directory.adapter.ts) queries IAM schema and encodes verified-email and active-administrator predicates. This couples the adapter to IAM's storage and policy representation.                                                                                                                                              | Work 7. Compare the existing synchronous bridge with IAM-owned queries and an API-side mapping. Seek an ADR decision before changing ownership or retiring the package.                                                                                                      |
| **I1**  | IAM [projects versioned integration events](../../../packages/contexts/iam/src/application/events/iam-integration-event.ts). Audit and Notifications independently enforce subscribed topic versions, including session-started v2. They currently agree.                                                                                                                                                                                                        | Work 6. Exercise actual producer fixtures through both consumers. Preserve their independent validation and projection rules.                                                                                                                                                |
| **O1**  | The [outbox worker](../../../packages/contexts/messaging/src/application/services/outbox-worker.ts) logs technical errors, and the [outbox](../../../packages/contexts/messaging/src/domain/entities/outbox-message.entity.ts) and [delivery](../../../packages/contexts/notifications/src/domain/entities/notification-delivery.entity.ts) store truncated error text. The source confirms the diagnostic path, with no observed real disclosure in this audit. | Work 2. Determine allowable diagnostics and operator needs. Propose a separate hardening Work if warranted.                                                                                                                                                                  |
| **O2**  | The [outbox schema](../../../packages/adapters/messaging/persistence-kysely/src/migration.ts) retains payload and context. The [delivery schema](../../../packages/adapters/notifications/persistence-kysely/src/migration.ts) retains destinations. The audited paths did not show equivalent cleanup to Audit expiry and deletion handling. Retry exhaustion can delay asynchronous cleanup.                                                                   | Work 2. Trace retention, late replay, reconciliation, and completion reporting against the [Account Data specification](../../specifications/SF-ACCOUNT-DATA-001.md), [Audit specification](../../specifications/SF-SECURITY-AUDIT-001.md), and Notifications specification. |
| **N4**  | [Single acknowledgement](../../../packages/adapters/notifications/persistence-kysely/src/kysely-notification.repository.adapter.ts) saves loaded read and archive state. Races can overwrite timestamps or archive state. The bulk update includes unread archived rows, whereas normal inbox reads exclude them.                                                                                                                                                | Work 8. Resolve archived-item and concurrent-archive behavior. Assess a recipient-scoped conditional update of the read timestamp alone.                                                                                                                                     |

## Work sequence and relationships

| Work                                                                                                          | Finding IDs | Proposed delivery sequence and boundaries                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [1. Notification list ownership](https://github.com/Oxelio/Architecture-Web/issues/106)                       | N1          | First correction. One independent execution unit, with focused Readiness and explicit implementation authorization.                                                                     |
| [2. Retention, erasure, and diagnostics investigation](https://github.com/Oxelio/Architecture-Web/issues/107) | O2, A2, O1  | High-priority discovery in parallel. Produce a separate conclusion and follow-up recommendation for each finding.                                                                       |
| [3. Mechanical enforcement and build separation](https://github.com/Oxelio/Architecture-Web/issues/108)       | E1, E2      | Recommended next implementation after Work 1. Lint and build increments have separate evidence. [Work #48](https://github.com/Oxelio/Architecture-Web/issues/48) is historical context. |
| [4. SHA-256 public entry point](https://github.com/Oxelio/Architecture-Web/issues/109)                        | E3          | Independent of Work 3. Resolve source compatibility before restricting resolution.                                                                                                      |
| [5. Audit capabilities](https://github.com/Oxelio/Architecture-Web/issues/110)                                | A1          | Independent after scope and contract decisions. Keep existing fingerprint behavior while Work 2 investigates A2.                                                                        |
| [6. Notifications organization and event verification](https://github.com/Oxelio/Architecture-Web/issues/111) | N2, I1      | Independent internal organization and compatibility increments. Coordinate test fixtures with Work 5 if their branches overlap.                                                         |
| [7. IAM-owned recipient query boundary](https://github.com/Oxelio/Architecture-Web/issues/112)                | N3          | Independent of the Notifications reorganization. Design and human structural acceptance precede implementation.                                                                         |
| [8. Acknowledgement consistency](https://github.com/Oxelio/Architecture-Web/issues/113)                       | N4          | Independent discovery. A later correction depends on the resolved behavior and a concurrency test plan.                                                                                 |

This sequence establishes delivery order without mandatory inter-Work
dependencies. Implementation is subject to the project's Work-in-progress limit,
applicable authority gates, and candidate validation.

## Open decisions and follow-up owners

- **E3 and A1:** The maintainer confirms the supported source-consumer boundary
  and accepts any export restriction or public contract removal. Preserve the
  documented SHA-256 root and migrate any supported affected consumer.
- **N3:** Compare retaining the shared-database bridge with moving verified
  contact and active-administrator SQL into IAM persistence behind a narrow IAM
  application query contract. The recommended API bridge would implement the
  Notifications-owned directory port and preserve synchronous reads. The
  structural choice, ADR, and any package retirement require explicit acceptance.
- **O2:** The functional, privacy, and operations owners resolve retention,
  deletion and anonymization, replay markers, dead-letter recovery, and truthful
  completion reporting. The exploration establishes no new retention window.
- **A2 and O1:** Identify separate follow-up Work for pseudonymization ownership
  or diagnostic minimization where warranted. Any keyed fingerprint design needs
  decisions on keys, rotation, historical correlation, and migration. Diagnostic
  changes need privacy and operational acceptance of the permitted fields.
- **N4:** The functional owner resolves archived-item behavior, acknowledgement
  idempotence, and the response to a concurrent archive. Test single versus
  single, single versus bulk, archive versus read, and recipient isolation before
  accepting any persistence correction.

Synchronize current architecture documentation only after the corresponding
implementation becomes effective. Approved product behavior remains owned by its
Functional Specification, and accepted durable structural choices belong in
their ADRs.
