# Technical Design — Account-deletion pre-confirmation disclosure

> **Identifier:** TD-ACCOUNT-DELETION-DISCLOSURE-001
>
> **Artifact status:** Proposed
>
> **Content status:** Proposed
>
> **Document type:** Technical Design
>
> **Domain:** Identity and Access Management / HTTP / Web
>
> **Work:** [#174](https://github.com/Oxelio/architecture-web/issues/174)

## Work context and authority

- **Work Type:** Defect Correction.
- **Change Characteristics:** Security-sensitive; API/application/Web contract compatibility; concurrent configuration publication.
- **Workflow Depth:** Complex (reclassified from Standard for security-sensitive deletion, concurrency and a breaking HTTP contract); no production rollout or data migration is required for this Work.
- **Functional owner:** [SF-ACCOUNT-DATA-001](../specifications/SF-ACCOUNT-DATA-001.md), especially deletion request, cancellation and final deletion; notification delivery remains owned by [SF-NOTIFICATIONS-001](../specifications/SF-NOTIFICATIONS-001.md).
- **Architecture owners:** [Architecture principles](../project/architecture-principles.md), [dependency rules](../architecture/dependency-rules.md), [IAM security](../architecture/iam-security.md), [packages and public APIs](../architecture/packages.md).
- **Method:** [Project Method Profile](../project/project-method-profile.md) and the adopted Software Engineering Method submodule.
- **Human functional decisions:** The requester accepted D1 (complete disclosure), D2 (block when effective duration is unavailable), D3 (fresh confirmation if duration changes), D4 (preserve existing deletion/security behavior), and D5 (dedicated confirmation modal), including dialog-local password and MFA proof inputs. On 2026-11-23, the maintainer selected **Solution C** for the Web presentation: a dedicated information page followed by a compact confirmation modal. This refines where approved disclosures appear, without changing the existing IAM deletion behavior. See [Work #174 UX decision](https://github.com/Oxelio/architecture-web/issues/174#issuecomment-7101972011).
- **Functional Approval:** On 2026-11-22, the human maintainer explicitly approved the exact proposed [SF-ACCOUNT-DATA-001 amendment](../specifications/SF-ACCOUNT-DATA-001.md) for Work #174; see the [issue approval record](https://github.com/Oxelio/architecture-web/issues/174#issuecomment-7084672138). This establishes an **Approved Target**, not currently implemented behavior.
- **Technical authority:** The human maintainer accepted replacing the existing HTTP v1 POST request contract without legacy support or production rollout, recorded in [Work #174](https://github.com/Oxelio/architecture-web/issues/174#issuecomment-7084906647). The focused [pre-implementation architecture review](https://github.com/Oxelio/architecture-web/issues/174#issuecomment-7084943575) found the transaction/ports approach suitable for Readiness, subject to real PostgreSQL evidence during validation. These decisions do not imply implementation or merge approval.

This design is a **proposed target**, not a description of implemented behavior. Do not synchronize current-architecture documentation until the implementation becomes effective.

## 1. Problem and boundaries

The current Web confirmation does not show the effective deletion grace period or all disclosures required by the Functional Specification. The IAM use case currently obtains the effective account policy and schedules deletion from `accounts.deletionGraceDays`, but the public capability response supplies only an `accountDeletion` boolean and the deletion response supplies `scheduledFor` only after mutation.

This Work restores the disclosure and explicit acceptance of the duration without changing the approved account lifecycle, cancellation, erasure, verified-address notification, last-administrator guard, strengthened authentication, MFA, audit, or session revocation. The policy remains owned by IAM. No new bounded context, general-purpose configuration service, or administrative configuration exposure is justified.

## 2. Responsibility ownership

| Boundary                    | Responsibility                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| IAM domain                  | Existing deletion lifecycle and policy vocabulary; no HTTP or Web dependencies                                                                         |
| IAM `accounts` application  | Read a minimal deletion disclosure projection; verify an explicitly confirmed duration; coordinate existing deletion behavior                          |
| IAM application-owned ports | Read the effective published account policy and obtain a transactional consistency fence for deletion                                                  |
| IAM persistence adapter     | Keep deletion acceptance and effective-policy comparison consistent with configuration publication; preserve the last-administrator and account checks |
| HTTP adapter                | Authenticate, validate/map request and response schemas, add no-store response headers; map closed error codes to statuses                             |
| Web                         | Show all required disclosures, accept/reject confirmation, localize the UI, handle loading/failure/conflict without an unintended mutation             |
| API composition root        | Construct and expose IAM application contracts and concrete adapters                                                                                   |

Avoid calling the administrative security-configuration application contract from a self-service route. Do not import the IAM domain model or database adapter into Web or API transport.

## 3. Read-only disclosure contract (proposed)

A dedicated authenticated self-service operation under the existing `accounts` capability returns only the information needed for the decision:

```http
GET /v1/iam/me/deletion
```

```json
{
  "data": {
    "enabled": true,
    "gracePeriodDays": 30
  }
}
```

- Require the existing authenticated session, derive the actor from authenticated context, and never accept an arbitrary user ID.
- A read does not require password/MFA step-up and does not mutate deletion or authentication state.
- Reuse the existing operation-scoped `AccountPolicyReader` / `PublishedIamPolicies` capability, which reads the complete published policy without a process-local cache or fallback.
- Project only `accounts.deletion` and `accounts.deletionGraceDays` in a new explicit IAM application operation. Do not return published revision history, configuration secrets, other security fields, or privileged administrative data.
- Define a typed HTTP response schema; send `Cache-Control: no-store`. React Query may hold the value transiently for display but must refetch upon reopening or retry.
- A disabled policy is represented explicitly. An unreadable or invalid published policy remains a technical failure (no fabricated default or business success). The frontend cannot confirm during loading, failure, or disabled state.
- The projection is **informational**, not an authorization for a subsequent mutation; the server must re-evaluate the policy when accepting a request.

This GET route and the JSON field names are candidates for Technical Design, not an already-approved external contract.

## 4. Deletion confirmation contract and expected outcomes (proposed)

Keep the existing `POST /v1/iam/me/deletion` and its current `password`, `confirmation`, optional `mfaCode` and successful `202 { data: { scheduledFor } }` semantics. Propose adding a confirmation datum such as:

```json
{
  "password": "...",
  "confirmation": "DELETE",
  "mfaCode": "...",
  "confirmedGracePeriodDays": 30
}
```

The confirmed number is **not an instruction to schedule deletion** and cannot override published policy. It is an assertion of the duration the user has just confirmed. The application calculates the schedule from the effective policy, not from client input.

- If the confirmed duration differs from the effective duration at the start of the command, reject with an expected domain/application result such as `account_deletion.grace_period_changed`.
- Recheck the effective duration at the transaction's consistency boundary (section 5). A change before accepted persistence rejects without accepting a deletion request.
- Map this expected outcome to HTTP `409 Conflict`. On conflict, the Web reloads current disclosure, shows the new value, and requires another explicit confirmation. Do not automatically resubmit.
- Continue to distinguish existing expected outcomes (`account_deletion.disabled`, `administrator.last_active_access`, reauthentication failures and account concurrency conflict) from unexpected infrastructure failures.
- Preserve existing behavior of `202` on success, session-cookie clearing, invalidation, auditing and notification side effects.

The maintainer **accepted** making `confirmedGracePeriodDays` required on the existing HTTP v1 POST without legacy compatibility. See section 8. An omitted confirmation is rejected rather than silently accepted under an old request shape.

## 5. Effective-policy consistency at the transaction boundary

A simple GET and a one-time policy read in `RequestAccountDeletionUseCase` do not prove the value is still effective when deletion is persisted. Security-configuration publication and deletion must not race in a way that accepts a duration the user did not confirm.

Proposed consistency mechanism:

1. The Web shows and the user confirms an effective duration. Its own dialog-local password/MFA proof fields are collected for the existing strengthened verification, and the HTTP adapter passes the confirmed value to the `accounts` command.
2. The application reads the effective policy, rejects disabled/mismatched values, and executes existing strengthened verification. This early check avoids avoidable work but is **not** the final concurrency guarantee.
3. The application computes `scheduledFor` from its captured policy, as today, and passes the captured duration to the existing deletion persistence capability for a final consistency check.
4. In the deletion transaction, acquire advisory locks in the same order used by IAM administration: administrative-access lock `728194002`, then security-configuration lock `728194001`, **before** locking/mutating the account. Read the currently published policy **after** acquiring the configuration lock, within the same transaction, using a transaction snapshot that can observe the configuration revision serialized before the lock (the current PostgreSQL default is READ COMMITTED; re-evaluate if transaction isolation changes).
5. If deletion is disabled or the published grace period differs from the confirmed/captured period, return a closed expected refusal with no deletion request persisted and no deletion-related revocation or notification. Otherwise preserve the existing last-administrator checks, account transition, persistence and outbox transaction.
6. Commit the request while still holding the configuration lock. Publication also holds that lock, preventing a new duration from becoming effective between the final comparison and commit. Then retain the existing post-persistence session cleanup and verified-address notification flow.

### Feasibility evidence from the existing persistence code

- `KyselySecurityConfigurationAdapter.publish` acquires the administrative-access lock `728194002`, then configuration lock `728194001`, then the configuration row lock before publication.
- `KyselyAccountDeletionAdapter.request` already acquires `728194002` before locking the account row; it currently does **not** acquire `728194001` or recheck the deletion grace period at persistence time.
- `administrative-access.ts` documents administrative lock ordering; other inspected IAM unit-of-work and MFA workflows acquire the administrative lock before relevant account locks. The startup-only security configuration initializer uses the configuration lock without an administrative lock.
- A transaction-bound instance of the existing `KyselySecurityConfigurationAdapter` can supply the persisted published snapshot; the final design must avoid introducing an application-to-adapter dependency. The deletion adapter can perform a narrow transaction-bound policy read behind its existing port.
- This evidence supports the lock-order proposal but is **not** proof of freedom from deadlocks or of expected concurrent behavior. Audit remaining participating writers during Architecture Review and execute real PostgreSQL publication/deletion interleavings during validation.

This is a **candidate** change to the `AccountDeletionStore.request` port/adapter and its result contract, not permission to import database details into the application layer. The adapter enforces the transaction-specific fence; the application owns the policy/deletion rule and error semantics. Validate locking and error propagation against real PostgreSQL, including the publisher's existing lock order. Do not hold a database transaction through SMTP delivery.

An equal effective grace-period value after an unrelated revision change need not invalidate confirmation: D3 concerns a _changed duration_, not every configuration revision. If a later accepted requirement demands revision-level confirmation instead, revisit this choice before implementation.

A concurrent policy change discovered after reauthentication may already have affected an MFA attempt/code through the existing verification flow. That effect is distinct from the deletion mutation and must be addressed in UX/retry tests without silently changing MFA semantics.

## 6. Web information page and compact confirmation dialog

The maintained Web target (Solution C, selected on 2026-11-23) separates **reading the full consequences** from **submitting a confirmed destructive request**:

1. From account/security settings, navigate to a dedicated authenticated account-deletion **information page**. It presents the effective configured grace period and all disclosures owned by the approved [Functional Specification](../specifications/SF-ACCOUNT-DATA-001.md): immediate access loss; intended data erasure; qualified legal/audit retention, backups and external resources; consequences for administrators, including the last-active-administrator constraint; and the warning about previously authorized notifications. It also explains the existing verified-address cancellation link with strengthened verification during the grace period. Present these categories in the current FR/EN language with correct duration pluralization, using ordinary page layout and scrolling instead of a full-height modal.
2. A deliberate **Continue** action opens a short native confirmation dialog with the actual duration, an immediate-access-loss reminder, a checkbox acknowledging the effective duration and the previously reviewed consequences, dialog-local current-password proof and conditional MFA code, and Cancel / Request deletion actions. Detailed mandatory consequences must already have been visible and available on the information page before this modal can open; do not hide required details in optional accordions or behind a new action after consent.
3. Keep the entire pre-submission journey on the first-party Web client. Reuse the existing authenticated, read-only IAM disclosure projection and existing destructive POST contract; no new backend operation, data model, privileged policy query or cross-context abstraction is justified.

### Policy freshness and consent state

- On entry to the information page, load the effective disclosure. Show explicit loading, retryable technical failure and disabled-policy states, **without displaying 14 days as a fallback**. Block Continue and destructive submission if the policy cannot be read or deletion is disabled.
- The confirmation dialog uses a **current** server-read duration, not an unexamined cached value. Refresh or verify the current disclosure when entering the confirmation step; a changed value invalidates previous consent and requires renewed review of the actual duration. Do not automatically carry an acknowledgment across a duration update, failed read, or route re-entry.
- Bind the submitted `confirmedGracePeriodDays` to the duration explicitly acknowledged in the current confirmation step. Only the server determines `scheduledFor`. Preserve the transaction-level publication/deletion consistency check.
- On the typed `409` for a changed grace period, abandon the previous consent and proof, show the new duration and require the user to review/acknowledge again before submitting. Never retry the POST automatically. Changing the language or refetching policy must not submit a request.
- On entry to each fresh confirmation step, collect **modal-local** password and (if enabled) MFA proof rather than reusing credentials from unrelated SecurityCenter forms. Clear secrets on close, policy conflict and successful request. Preserve existing last-administrator refusal, sanitized errors, no-duplicate-submit guard, and the current success redirect/session behavior.
- Cancellation of the **confirmation dialog** only dismisses the pending UI. The established account-deletion cancellation link is a distinct operation available after a deletion request has been accepted.

### Accessibility and responsiveness

- Keep the information page navigable in the regular page flow, with semantic headings and natural scrolling; do not nest a long scrollable legal document in the modal.
- Prefer the existing native HTML `<dialog>` for the compact confirmation. Provide initial and restored focus, keyboard containment, Escape handling during idle/pending states, accessible labels and live error announcements. Avoid a new generic dialog framework or UI library without an established need.
- At **320 CSS pixels** and **200% browser zoom**, ensure all approved information on the page remains readable/reachable, and that modal controls and destructive actions remain reachable without scrolling through the full consequence disclosure. A compact modal may still need ordinary small-screen overflow; never clip required controls or remove the ability to cancel.
- A navigation failure, language switch, newly disabled policy, or refetch must not bypass the preceding information stage or silently enable the POST.

This target replaces the previous single, full-disclosure scrollable modal **only in the approved Work scope**; code on `main` remains current truth until PR #176 is merged. It preserves the already-approved D5 requirement for a dedicated confirmation dialog while moving long-form disclosures to the information page.

## 7. Security, privacy and failures

- No self-service user receives administrative policy revision history or other configuration fields through the new GET.
- Unauthenticated requests to the GET and POST remain unauthorized. Existing session cookie protections and same-site policy remain untouched.
- Unexpected configuration read failures remain technical failures, with sanitized HTTP errors; the Web blocks the confirmation and offers retry. No fallback to 14 days.
- The server remains authoritative when the Web is stale or a client is modified. A malicious client-provided number does not set the schedule.
- Preserve rate limits, reauthentication proof, MFA, existing last-admin refusal, event/outbox behavior and email flows.
- Do not treat logging, analytics, or translated strings as permission to record passwords or MFA codes.

## 8. HTTP v1 contract replacement and development environment

### Accepted work-level decision (2026-11-22)

The human maintainer explicitly accepts **breaking the existing HTTP v1 account-deletion POST contract**, with no legacy compatibility path, API version migration or staged rollout. There is currently **no production environment** to support, and the project's development data is reset/recreated rather than preserved through a migration for this Work. This is an accepted **Work-scoped technical/compatibility decision**, not an implicit change to the repository-wide release, migration or governance policy.

### Existing consumers and contract replacement

The source inventory identifies the first-party Web function `apps/web/src/services/api.ts`, its `SecurityCenter` caller, the HTTP controller `apps/api/src/features/iam/security/security.routes.ts` and related contract tests. No separately published SDK was identified. The maintainer confirms that there is no production compatibility obligation for this Work.

- Add authenticated `GET /v1/iam/me/deletion` returning only the effective deletion availability and grace-period days with `Cache-Control: no-store`.
- Require `confirmedGracePeriodDays` in `POST /v1/iam/me/deletion`. An omitted, malformed or out-of-range value fails validation and **cannot initiate deletion**; a stale, otherwise valid duration receives the typed `409` application outcome. Validate as an integer within the supported 1–90 policy range.
- Update the first-party Web client, API schema, application contract, persistence implementation and tests in the same candidate. Remove obsolete confirmation behavior and test expectations rather than preserving adapter facades, deprecated fields or conditional legacy logic.
- Preserve the existing accepted success response, strengthened authentication, MFA, cancellation and irreversible security effects. No change to deletion and audit persistence schemas is expected.
- The same `/v1` URL is retained as an intentional breaking correction. Update the PR Conventional Commit metadata to indicate breaking behavior when the implementation lands.
- No phased compatibility layer, old-client support, API v2 duplication, production rollout or production rollback plan is required **for the currently declared environment**.

### Development/test data resets

The maintainer reports development environments whose data is recreated from scratch. The expected code change does not require a schema migration or data conversion. Where fixtures must be reinitialized, use only the repository's documented **isolated development/test environments** and controlled reset procedures. Do not execute destructive resets against unspecified databases or assume that every environment is disposable solely because production does not currently exist.

If a persistent external deployment or client is introduced in the future, its compatibility obligations are a new explicit scope decision, not a reason to retain unused legacy branches in Work #174.

## 9. Validation strategy

Use the [testing and verification policy](../development/testing.md), proportional to the affected boundaries.

| Boundary                          | Required focused evidence                                                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IAM application                   | Effective non-default period, disabled policy, equality/mismatch outcomes, no scheduling from client value, unchanged strengthened verification and deletion semantics           |
| IAM persistence / real PostgreSQL | Concurrent publication before, during and after deletion acceptance; lock-order/deadlock check; no persistence/outbox on conflict; last-admin check preserved                    |
| HTTP contract                     | Authenticated-only read, minimal projection, no-store, typed payload, required confirmation handling, mapped 409/403/401 and sanitized 5xx                                       |
| Web page and compact dialog       | All six disclosures on the information page; FR/EN and 1–90-day boundaries; no skipped page or fallback; loading/failure/disabled/changed-policy states; modal-local consent/proof; double-click prevention |
| Accessibility                     | Natural page reading/scroll, dialog labels and focus restoration, keyboard/Escape, screen-reader error announcements, 320 CSS px / 200% zoom, reachable confirmation controls |
| Regression                        | MFA, password reauthentication, session revocation, cancellation, notification delivery, audit, last administrator and `scheduledFor`                                            |

Run the affected unit/HTTP/Web suites, TypeScript, lint, format and Markdown link checks. Real PostgreSQL concurrency evidence must not be inferred from mocked unit tests or skipped integration suites. A successful CI run alone does not approve Functional, Architecture, Code or security/privacy review findings.

## 10. Alternatives and rationale

| Alternative                                               | Evaluation                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hard-code 14 days                                         | Rejected: may differ from the effective policy and violates the existing Functional Specification        |
| Extend public `/iam/capabilities` with duration           | Technically possible but unnecessarily broad for a self-service, security-sensitive confirmation journey |
| Read administrator configuration from Web                 | Rejected: privileged data and authorization boundary                                                     |
| Dedicated authenticated `accounts` disclosure read        | Preferred: small projection with clear least-privilege ownership                                         |
| Compare only in the Web / before the POST                 | Rejected: races with configuration publication                                                           |
| Persist request under a shared publication/deletion fence | Preferred: ensures effective-duration comparison at acceptance, subject to real integration tests        |
| Versioned/managed legacy client migration                 | Rejected for the declared no-production Work scope; breaking HTTP v1 replacement explicitly accepted     |
| Single full-disclosure scrollable modal                    | Superseded after browser UX evidence: content and confirmation actions compete for limited viewport height |
| Information page + compact confirmation dialog             | Selected by the maintainer (2026-11-23): readable disclosure in normal page flow, short explicit destructive confirmation |
| Two-step wizard inside the same long modal                 | Not selected: adds focus/step complexity without resolving the constrained reading surface                  |

A local API/application consistency change using existing architecture does not currently warrant an ADR. Re-evaluate if the final solution introduces a durable cross-cutting transaction or versioning rule.

## 11. Resolved decisions and validation risks

1. **Resolved — Functional authority:** the human maintainer explicitly approved the exact SF amendment for Work #174 on 2026-11-22; see the [approval record](https://github.com/Oxelio/architecture-web/issues/174#issuecomment-7084672138). This authorizes the functional **Approved Target** only. Current implementation and HTTP contract are unchanged.
2. **Resolved — HTTP contract authority:** the maintainer explicitly accepted a breaking HTTP v1 replacement with no legacy client path, no production rollout and disposable development data. See section 8 and the Work #174 decision record. Update the first-party Web and API together; do not add compatibility adapters.
3. **Resolved at design level — Concurrency feasibility:** the existing persistence code shows publication locks administrative access (`728194002`) before configuration (`728194001`), while deletion currently obtains administrative access before the account lock. Acquiring the configuration lock after the administrative lock and before the deletion account row, with a fresh published-policy read in the same READ COMMITTED transaction, is an acceptable design; see the [focused review](https://github.com/Oxelio/architecture-web/issues/174#issuecomment-7084943575). **Evidence still required:** actual PostgreSQL publication/deletion race, deadlock, disabled-policy, no-side-effects and preservation tests against the implemented candidate.

**Readiness assessment:** all target-level functional, breaking HTTP v1 and architectural design decisions for this Work are resolved. A separate Readiness Review records whether the Work may enter implementation, and carries the required security, concurrency and accessibility validation risks forward. Design acceptance does not count as completed code, tests or downstream reviews.

## 12. Task-planning inputs

Task Planning is triggered: IAM application, transactional persistence, breaking HTTP contract and Web accessibility are independently verifiable execution units that require sequencing. The native GitHub Task Sub-issues under [Work #174](https://github.com/Oxelio/architecture-web/issues/174) are the operational owners:

- [Task #177](https://github.com/Oxelio/architecture-web/issues/177) — effective-policy disclosure in the IAM accounts application.
- [Task #178](https://github.com/Oxelio/architecture-web/issues/178) — confirmed duration, persistence publication fence and real PostgreSQL concurrency evidence.
- [Task #179](https://github.com/Oxelio/architecture-web/issues/179) — authenticated HTTP GET / confirmed breaking v1 POST without legacy handling.
- [Task #180](https://github.com/Oxelio/architecture-web/issues/180) — accessible FR/EN dialog and modal-local password/MFA proof inputs (completed implementation history).
- [Task #186](https://github.com/Oxelio/architecture-web/issues/186) — redesign the Web journey into a complete disclosure page plus a compact, accessible confirmation dialog (planned; requires updated Readiness).

Tasks #177–#180 implemented the original IAM/application/HTTP/Web scope and are closed. For the maintainer-selected revision, implement Task #186 only after the focused Web design/readiness check; then run the affected Web and existing boundary regressions, repeat applicable reviews and collect new real-browser evidence at Work level. No compatibility migration or production rollout Task is required for the declared environment.

Each Task references this Technical Design, the approved Functional Specification and canonical project constraints, and does not own alternative product behavior or a separate Work State. No Task may be executed until the parent Work passes Readiness and becomes Ready.
