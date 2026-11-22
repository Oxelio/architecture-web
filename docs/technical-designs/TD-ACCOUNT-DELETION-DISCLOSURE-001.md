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
- **Workflow Depth:** Standard, subject to reassessment if compatibility requires a wider migration.
- **Functional owner:** [SF-ACCOUNT-DATA-001](../specifications/SF-ACCOUNT-DATA-001.md), especially deletion request, cancellation and final deletion; notification delivery remains owned by [SF-NOTIFICATIONS-001](../specifications/SF-NOTIFICATIONS-001.md).
- **Architecture owners:** [Architecture principles](../project/architecture-principles.md), [dependency rules](../architecture/dependency-rules.md), [IAM security](../architecture/iam-security.md), [packages and public APIs](../architecture/packages.md).
- **Method:** [Project Method Profile](../project/project-method-profile.md) and the adopted Software Engineering Method submodule.
- **Human functional decisions:** Work #174's requester explicitly accepted D1 (complete disclosure), D2 (block when effective duration is unavailable), D3 (fresh confirmation if duration changes), D4 (preserve existing deletion/security behavior), and D5 (dedicated confirmation modal). The proposed wording of the amendment to the canonical Functional Specification and the technical contract in this document remain subject to review. An issue or draft PR is not an approval of a new API contract.

This design is a **proposed target**, not a description of implemented behavior. Do not synchronize current-architecture documentation until the implementation becomes effective.

## 1. Problem and boundaries

The current Web confirmation does not show the effective deletion grace period or all disclosures required by the Functional Specification. The IAM use case currently obtains the effective account policy and schedules deletion from `accounts.deletionGraceDays`, but the public capability response supplies only an `accountDeletion` boolean and the deletion response supplies `scheduledFor` only after mutation.

This Work restores the disclosure and explicit acceptance of the duration without changing the approved account lifecycle, cancellation, erasure, verified-address notification, last-administrator guard, strengthened authentication, MFA, audit, or session revocation. The policy remains owned by IAM. No new bounded context, general-purpose configuration service, or administrative configuration exposure is justified.

## 2. Responsibility ownership

| Boundary | Responsibility |
| --- | --- |
| IAM domain | Existing deletion lifecycle and policy vocabulary; no HTTP or Web dependencies |
| IAM `accounts` application | Read a minimal deletion disclosure projection; verify an explicitly confirmed duration; coordinate existing deletion behavior |
| IAM application-owned ports | Read the effective published account policy and obtain a transactional consistency fence for deletion |
| IAM persistence adapter | Keep deletion acceptance and effective-policy comparison consistent with configuration publication; preserve the last-administrator and account checks |
| HTTP adapter | Authenticate, validate/map request and response schemas, add no-store response headers; map closed error codes to statuses |
| Web | Show all required disclosures, accept/reject confirmation, localize the UI, handle loading/failure/conflict without an unintended mutation |
| API composition root | Construct and expose IAM application contracts and concrete adapters |

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

A required `confirmedGracePeriodDays` would **break** clients using the previous POST contract. See section 8: selecting a compatibility route is a Readiness blocker, not a reason to allow an unconfirmed legacy bypass.

## 5. Effective-policy consistency at the transaction boundary

A simple GET and a one-time policy read in `RequestAccountDeletionUseCase` do not prove the value is still effective when deletion is persisted. Security-configuration publication and deletion must not race in a way that accepts a duration the user did not confirm.

Proposed consistency mechanism:

1. The Web shows and the user confirms an effective duration. The HTTP adapter passes the confirmed value to the `accounts` command.
2. The application reads the effective policy, rejects disabled/mismatched values, and executes existing strengthened verification. This early check avoids avoidable work but is **not** the final concurrency guarantee.
3. The application computes `scheduledFor` from its captured policy, as today, and passes the captured duration to the existing deletion persistence capability for a final consistency check.
4. In the deletion transaction, acquire advisory locks in the same order used by IAM administration: administrative-access lock `728194002`, then security-configuration lock `728194001`, **before** locking/mutating the account. Read the currently published policy **after** acquiring the configuration lock, within the same transaction.
5. If deletion is disabled or the published grace period differs from the confirmed/captured period, return a closed expected refusal with no deletion request persisted and no deletion-related revocation or notification. Otherwise preserve the existing last-administrator checks, account transition, persistence and outbox transaction.
6. Commit the request while still holding the configuration lock. Publication also holds that lock, preventing a new duration from becoming effective between the final comparison and commit. Then retain the existing post-persistence session cleanup and verified-address notification flow.

This is a **candidate** change to the `AccountDeletionStore.request` port/adapter and its result contract, not permission to import database details into the application layer. The adapter enforces the transaction-specific fence; the application owns the policy/deletion rule and error semantics. Validate locking and error propagation against real PostgreSQL, including the publisher's existing lock order. Do not hold a database transaction through SMTP delivery.

An equal effective grace-period value after an unrelated revision change need not invalidate confirmation: D3 concerns a *changed duration*, not every configuration revision. If a later accepted requirement demands revision-level confirmation instead, revisit this choice before implementation.

A concurrent policy change discovered after reauthentication may already have affected an MFA attempt/code through the existing verification flow. That effect is distinct from the deletion mutation and must be addressed in UX/retry tests without silently changing MFA semantics.

## 6. Web confirmation dialog and state management

Replace the current native `window.confirm()` within `SecurityCenter` with a dedicated accessible dialog:

- When opened, load the authenticated disclosure using the read-only contract. Show loading, retryable technical failure and disabled states; never display the default as a fallback.
- Present the duration with correct FR/EN localization and pluralization, and all approved disclosures: immediate access loss, deleted-data categories, retained-data categories and reasons, last-administrator consequences, and the separate warning about previously authorized notification delivery.
- The confirmation is an explicit user action. It is disabled until effective disclosure is available, required strengthened proof is entered, and no deletion request is pending.
- The dialog may contain password/MFA inputs rather than silently reusing credentials shared with unrelated SecurityCenter actions; settle the local placement to preserve existing reauthentication and MFA semantics and clear sensitive state on closure when applicable.
- Changing locale or refetching disclosure must never submit the POST. If a refetch shows a different duration, invalidate the earlier consent and require explicit reconfirmation.
- On `409` for a changed grace period, discard the previous consent, refresh the read, and await new confirmation. Do not automatically retry POST.
- Prevent unintended double submission while a request is pending. Preserve the existing success redirect/session handling. Cancellation of the **dialog** is not cancellation of an already accepted deletion request.
- Provide dialog semantics, focus trapping/restoration, keyboard navigation and Escape behavior, sensible accessible labels, error announcements and responsive scrolling. Prefer an established accessible component/native primitive rather than a custom generic dialog framework.

User-facing categories must faithfully summarize the Functional Specification, including the qualified nature of legal retention; do not promise unconditional deletion of backups, external-context resources, or audit history.

## 7. Security, privacy and failures

- No self-service user receives administrative policy revision history or other configuration fields through the new GET.
- Unauthenticated requests to the GET and POST remain unauthorized. Existing session cookie protections and same-site policy remain untouched.
- Unexpected configuration read failures remain technical failures, with sanitized HTTP errors; the Web blocks the confirmation and offers retry. No fallback to 14 days.
- The server remains authoritative when the Web is stale or a client is modified. A malicious client-provided number does not set the schedule.
- Preserve rate limits, reauthentication proof, MFA, existing last-admin refusal, event/outbox behavior and email flows.
- Do not treat logging, analytics, or translated strings as permission to record passwords or MFA codes.

## 8. Compatibility and migration — decision required

The API uses independently versioned HTTP `v1`. The existing request currently requires no duration confirmation field. Making that field mandatory for every POST is a behavioral and contract-breaking change for existing callers.

Before Readiness, determine whether there are supported callers other than the in-repository Web client and choose a compatibility strategy through the applicable API ownership/acceptance process. The default proposal is to require explicit duration confirmation for every accepted deletion request, migrate the first-party Web simultaneously, and coordinate an HTTP contract version or controlled client migration as needed.

**Do not** make the new field optional with a silent legacy acceptance path that would allow deletion without confirmed effective duration; that would violate the approved product behavior. Do not silently bump `v1` or assume there are no external consumers.

No database migration, new table, deletion-scheduler behavior change, or new public package boundary is expected. An application contract/port change requires coordinated updates to composition, adapters and test doubles.

## 9. Validation strategy

Use the [testing and verification policy](../development/testing.md), proportional to the affected boundaries.

| Boundary | Required focused evidence |
| --- | --- |
| IAM application | Effective non-default period, disabled policy, equality/mismatch outcomes, no scheduling from client value, unchanged strengthened verification and deletion semantics |
| IAM persistence / real PostgreSQL | Concurrent publication before, during and after deletion acceptance; lock-order/deadlock check; no persistence/outbox on conflict; last-admin check preserved |
| HTTP contract | Authenticated-only read, minimal projection, no-store, typed payload, required confirmation handling, mapped 409/403/401 and sanitized 5xx |
| Web component | All six disclosures, FR/EN and one-day pluralization, 1–90 day boundaries, loading/failure/disabled/changed-policy states, deliberate reconfirmation and double-click prevention |
| Accessibility | Dialog labels, initial and restored focus, keyboard and Escape, announced errors, responsive/scroll behavior |
| Regression | MFA, password reauthentication, session revocation, cancellation, notification delivery, audit, last administrator and `scheduledFor` |

Run the affected unit/HTTP/Web suites, TypeScript, lint, format and Markdown link checks. Real PostgreSQL concurrency evidence must not be inferred from mocked unit tests or skipped integration suites. A successful CI run alone does not approve Functional, Architecture, Code or security/privacy review findings.

## 10. Alternatives and rationale

| Alternative | Evaluation |
| --- | --- |
| Hard-code 14 days | Rejected: may differ from the effective policy and violates the existing Functional Specification |
| Extend public `/iam/capabilities` with duration | Technically possible but unnecessarily broad for a self-service, security-sensitive confirmation journey |
| Read administrator configuration from Web | Rejected: privileged data and authorization boundary |
| Dedicated authenticated `accounts` disclosure read | Preferred: small projection with clear least-privilege ownership |
| Compare only in the Web / before the POST | Rejected: races with configuration publication |
| Persist request under a shared publication/deletion fence | Preferred: ensures effective-duration comparison at acceptance, subject to real integration tests |
| Versioned/managed legacy client migration | To be decided before Readiness; no unconfirmed legacy deletion bypass |

A local API/application consistency change using existing architecture does not currently warrant an ADR. Re-evaluate if the final solution introduces a durable cross-cutting transaction or versioning rule.

## 11. Open decisions and Readiness blockers

1. **Functional authority:** review the exact proposed amendment to `SF-ACCOUNT-DATA-001` and record any required Human Functional Approval for the revised canonical behavior. D1–D5 were accepted in the Work conversation; a proposed document/PR itself is not an approval.
2. **HTTP compatibility owner:** inventory supported `POST /iam/me/deletion` clients and accept a concrete breaking-change / versioning / migration route before making the confirmation datum required.
3. **Concurrency feasibility:** confirm the shared advisory-lock ordering and transaction-visible effective-policy read against the existing persistence architecture, and define the required real-PostgreSQL acceptance scenario before Readiness. Execute that scenario against the implemented candidate during validation; do not misrepresent a pre-implementation test plan as executed evidence.
4. **UI design detail:** settle whether strengthened-proof inputs reside inside the modal, retaining existing MFA and password proof semantics. This is a local UX design choice, not a new account-deletion policy.

**Readiness assessment at authoring:** NOT READY — the above decisions/evidence are not complete. Do not start implementation solely because this design exists.

## 12. Task-planning inputs

If required during Preparing, sequence independently verifiable implementation work around: (a) IAM read projection and effective-duration confirmation contract, (b) transactional publication/deletion consistency and PostgreSQL tests, (c) HTTP exposure and compatibility, (d) accessible FR/EN Web dialog, and (e) regression and specialist review evidence. Each Task references this design, the approved Functional Specification and canonical project constraints; Tasks do not own alternative behavior.
