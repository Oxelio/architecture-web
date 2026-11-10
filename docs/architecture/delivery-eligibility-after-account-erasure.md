# Technical Design — Delivery eligibility after IAM account erasure

**Artifact status:** Accepted
**Content status:** Canonical
**Document type:** Technical Design
**Domain:** IAM / Notifications

## Work context

[Work #120](https://github.com/Oxelio/architecture-web/issues/120) is a Complex
Product Behavior Change. The approved target belongs to
[SF-NOTIFICATIONS-001](../specifications/SF-NOTIFICATIONS-001.md#delivery-eligibility-after-final-account-erasure)
and the disclosure to
[SF-ACCOUNT-DATA-001](../specifications/SF-ACCOUNT-DATA-001.md#disclosure-for-previously-authorized-deliveries).
The independent architecture review accepted the design direction, and the
maintainer accepted [ADR-0010](decisions/0010-iam-erasure-evidence.md) for
the scoped development/demo target.

## Authoritative eligibility

IAM implements the witness and three-result query from ADR-0010. Export the
query through IAM's application boundary. The API composition root supplies
it to the existing Notifications recipient-directory bridge. Extend that
Notifications port with an affected-user eligibility operation returning
`eligible`, `erased`, or `unresolved`. The query exposes no account
profile, destination, or witness key to Notifications. Keep the
[dependency direction](dependency-rules.md) and update all in-repository port
implementations and doubles together.

Use one IAM-owned version-one derivation for both witness insertion and
lookup. Preserve that derivation for existing records. A later version must
support backward-compatible lookup or explicitly migrate existing evidence
before activation.

Use a five-second end-to-end lookup budget for the development/demo target,
including pool acquisition and the statement. Ignore a result arriving after
timeout. A fresh attempt uses a fresh primary statement snapshot. Verify
indexed account and witness lookups. The existing deletion transaction gains
one local indexed insert and no dependency on a Notifications worker.

## Delivery processing

For an affected-user or mixed-basis delivery, use the existing claim token
and five-minute lease with two processing phases, checking eligibility and
provider admitted. Use a cumulative unresolved-check counter with a
provisional reservation for the in-progress check. Keep provider attempts
and the outcome of the last admitted attempt separate from the eligibility
closure reason. Use the existing delivery backoff and provider-attempt cap.

| Transition                              | Guard and effect                                                                                                                                                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claim and reserve check                 | Select a due claimable row with both budgets available. In the claim transaction, reserve one unresolved check and return recipient and claim metadata without hydrating the destination or message.                                                                                    |
| Conclusive erasure                      | Release the provisional check, close as withheld after confirmed erasure, and preserve the earlier provider outcome.                                                                                                                                                                    |
| Unresolved, timeout, or abandoned check | Consume the provisional reservation once. Retry with a new claim or close as eligibility unverified on the tenth unresolved result. A conclusive tenth result releases its reservation. Provider attempts are unaffected.                                                               |
| Eligible and admitted                   | In one transaction, release the check reservation, validate any applicable approved deadline, reserve one provider attempt, and hydrate the send snapshot. Only this execution may use the result for one invocation. The stored phase cannot be used to resume dispatch.               |
| Known no handoff                        | If erasure is confirmed or the unused authorization has expired before dispatch, close with the appropriate reason and release the provider reservation when the current owner can establish that no handoff occurred. The approved expiry outcome is withheld — authorization expired. |
| Abandoned after admission               | Preserve the provider reservation and unknown outcome. Recover as retryable or exhausted under the provider budget. A crash before the call and a lost handoff can be indistinguishable from durable state.                                                                             |
| Provider result                         | Only the current execution can settle its own admitted attempt. Stale or late results after replacement or closure cannot overwrite the outcome, reopen submission, or grant authorization.                                                                                             |

Worker settlement requires the delivery ID, phase, current token, and
unexpired lease. Recovery changes an expired phase and token atomically.
Check any applicable approved deadline again before application-controlled
handoff. A worker that knows it has lost authorization withholds the call.
These controls fence admission and persistence. They supply no wire-level
cutoff after erasure, lease expiry, or a data-use deadline.

Administrator-only deliveries retain their existing authorization and
accounting path. Mixed deliveries retain the accepted selection and follow
the approved rules for any remaining administrator basis. A prior
authorization, re-claim, or replay supplies no permission to send.

## Data, diagnostics, and migration

- Add the IAM witness table and additive Notifications columns for the check
  counter, processing phase, and minimized last provider outcome. Reuse the
  terminal suppression status with distinct reason codes. Keep administrator
  suppression separate.
- Allow a null destination only on terminal persistence rows. Require a
  non-blank destination in sendable states. The revised affected-user and
  mixed paths clear the saved destination atomically at terminal closure,
  including sent, provider exhaustion, and withholding. Keep non-null
  destination uniqueness. Hydrate the sendable domain entity only for a
  live snapshot. Release worker-held send references when processing ends.
- Message content stays in its existing inbox row. Add no durable send copy.
  Keep terminal evidence to the existing delivery and inbox link, bounded
  counters, minimized outcome, and reason. The link is potentially
  identifying. Preserve inbox ownership, read/archive state, and the
  separate event consumption marker, including empty selections. Terminal
  destination clearing leaves general inbox retention, historical outbox
  retention, and replay-marker retention with their respective owners.
- Map provider errors to allowlisted codes before persistence or logging.
  Apply this to the shared delivery boundary and delivery-polling failures.
  Exclude raw errors, nested causes, destinations, URLs, headers, and payloads.
  Existing historical diagnostics are outside this change.
- Quiesce old workers for upgrade. Initialize the eligibility counter at
  zero and preserve existing attempt counts and selections. Recover
  stranded legacy claims as uncertain provider attempts before any fresh
  authorization. Leave historical terminal rows and erasure events alone.
  Keep delivery stopped on upgrade failure until a forward fix or restoration
  of the disposable test environment. Old workers cannot resume on cleared
  destinations.

## Development/demo validation and cleanup

The [scoped testing approval](https://github.com/Oxelio/architecture-web/issues/120#issuecomment-6744821194)
uses fictitious accounts and simulated providers by default. Use the existing
disposable PostgreSQL/Redis integration fixture for database tests. Add a
separate disposable Compose project for API-to-Mailpit checks with temporary
PostgreSQL and Mailpit storage, Redis persistence disabled, and an internal
network without published ports. The API and Mailpit share a network namespace.
The smoke runner reaches Mailpit over loopback. The fixture has no Mailpit relay or external webhooks and
uses separate storage from the regular application.

Use a supervised 30-minute timeout for the optional controlled-address run.
The approved **24-hour maximum from creation** applies to local copies
containing the personal test address. Start supervision before personal
input, exclude the address and payload from retained logs and reports, and
remove test data at the end of use. Stop workers before teardown and verify
absence of test containers, storage, and capture data. Rehearse normal,
aborted, and timed-out cleanup with fictitious data before enabling personal
input. Enable controlled-address input only on a host where the supervision
and storage checks account for swap, crash dumps, and snapshots. A periodic
expiry setting alone supplies no deadline evidence.
External-provider testing requires prior provider review. These controls
authorize no production personal-data processing or general retention period.

## Task sequence and acceptance evidence

1. **IAM evidence and query.** Verify atomic deletion, witness and outbox
   rollback, account/witness contradictions, missing proof, holds and
   cancellation. Use two PostgreSQL sessions to control commits before,
   during, and after the eligibility snapshot. Verify erasure progress
   independently of a blocked provider stub.
2. **Notifications delivery.** Depends on IAM evidence. Test migration,
   concurrency, the tenth check in both conclusive and unresolved cases,
   stale results, pre-handoff expiry, uncertain handoff, and late outcomes.
   Verify terminal destination clearing, inbox and acknowledgement
   stability, replay, mixed and administrator-only behavior, and minimized
   diagnostics using synthetic values.
3. **Deletion disclosure.** Implement the approved wording in the existing
   pre-confirmation flow. Verify request and cancellation communications
   and absence of a final-erasure notification.
4. **Disposable capture and integrated validation.** Depends on
   Notifications delivery and deletion disclosure. Run the fictitious
   Mailpit smoke and cleanup scenarios. Rehearse optional personal-test
   controls without personal input. Run the candidate against
   `pnpm ci:test:integration` in the Docker-backed repository validation
   workflow and record the fixture and commands against the candidate SHA.

The [testing policy](../development/testing.md) requires real PostgreSQL and
Redis evidence for the changed persistence boundaries and full workspace
validation for public port changes. The existing `pnpm ci:test:integration`
command uses `compose.iam-test.yml` in the repository validation workflow.
The capture Task adds `compose.o2-mailpit-test.yml` and a one-shot
`node scripts/run-o2-mailpit-test.mjs` entry point for the fictitious-data
smoke and teardown checks on an authorized Docker runner. The entry point
starts a uniquely named project, verifies API-to-Mailpit delivery, and
tears down that project on completion or failure. Capture evidence records
the candidate SHA, run identity, command, and teardown result. Pass `--abort` or
`--timeout` to exercise the corresponding shutdown path after the fictitious
smoke. This fixture accepts only `@example.test` recipients. Use the approved
manual exception only on a separately supervised host that meets the
storage and cleanup conditions above.

The code and owner updates travel in the same Work Integration change.
