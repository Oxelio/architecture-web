# Technical Design — Delivery automation complexity reduction

> [Work #205](https://github.com/Oxelio/architecture-web/issues/205) supersedes the refactoring targets for the retired integration control plane (B1 and B3–B5). Those units and source paths are historical. B2 concerns retained read-only operational state and PR identity. The [delivery profile](../project/delivery-pipeline.md) owns current integration policy.
>
> **Identifier:** TD-SONAR-DELIVERY-AUTOMATION-001
>
> **Artifact status:** Prepared for implementation
>
> **Content status:** Approved Target for Work #187 / Task #189 (not effective Current Truth)
>
> **Document type:** Technical Design
>
> **Domain:** Delivery automation / GitHub integration

## Work context and authority

- **Work:** [#187](https://github.com/Oxelio/architecture-web/issues/187) — resolve outstanding Sonar findings.
- **Task:** [#189](https://github.com/Oxelio/architecture-web/issues/189) — reduce cognitive complexity in protected delivery controls.
- **Classification:** Technical Change / Standard (Work-level classification); behavior-preserving; operationally sensitive.
- **Technical authority:** Scope-bound technical design accepted by the Software Architect for readiness assessment. No separate human technical gate is required by the Project Method Profile for this behavior-preserving local design. This acceptance does **not** approve a material Governance Change, a new merge policy or a durable structural ADR decision.
- **Governance owners:** [Delivery profile](../project/delivery-pipeline.md) and [Project Method Profile](../project/project-method-profile.md). [CI-driven Work integration](../architecture/ci-driven-work-integration.md) records the retired design.
- **Validation owner:** [Tests and verification](../development/testing.md).
- **Working Task Plan:** [#189 preparation record](https://github.com/Oxelio/architecture-web/issues/189#issuecomment-7106046839). The plan records exact affected Sonar issue keys, but this Technical Design owns the proposed technical target and its boundaries.

This document is specific to the twelve `typescript:S3776` findings listed below. It does not modify the rules for who may admit, merge, publish, cancel or complete a Work.

## 1. Objective and scope

Reduce cognitive complexity of existing delivery-automation functions through **local, responsibility-preserving extractions**. The externally observed results, rejection codes, credential boundaries, authorization checks, remote operations, journal history, and ordering of reads and writes must remain identical.

Only implementation-private predicates, data parsing, read-only validation steps or branch handlers may be extracted where doing so reduces cognitive load. Keep existing modules and public interfaces as the owning boundaries. Do not add a new service, port, repository, state-machine framework or globally shared utility for code deduplication alone.

Out of scope:

- Functional behavior, Work States, Gate results, protected-branch or ruleset policy changes.
- Delegation activation, bypass authorization, or broad CI/merge workflow redesign.
- New or altered GitHub API effects, retry rules, journal schema, candidate identity or evidence acceptance rules.
- Sonar findings assigned to other Tasks (particularly #188 and #190), except for incidental line shifts.

A refactor requiring any out-of-scope change must return to Technical Design/appropriate authority before implementation rather than inventing an implicit exception.

## 2. Core preserved invariants

1. **Fail closed:** unavailable, stale, ambiguous, edited, foreign or inconsistent GitHub observations never become accepted authority or successful outcomes.
2. **Exact candidate identity:** Work, PR, repository, head/base SHA, check context, issuer and applicable reservation identity continue to match at every pre-existing gate.
3. **Durable write intent:** a pending reservation or receipt is persisted before remote mutation; a timeout/lost response does not authorize replay of a potentially executed write.
4. **Authority freshness:** live delegation, revocation, permitted actor, protected workflow and ruleset conditions are checked at their current boundaries. Do not cache an earlier authorization across the final mutation.
5. **Ordered recovery:** only verified read-back and positive terminal proofs allow release, reconciliation or completion. Unknown results remain deferred/quarantined.
6. **Current versus target:** existing candidate-bound native integration continues as currently implemented; standing/delegated integration stays inactive until its separate activation gate.
7. **No new business errors:** internal technical failures retain existing error categories and outward outcome shapes.

These invariants are constraints inherited from current code and repository owners, **not** newly defined governance policy.

## 3. Implementation units and ownership

Source paths below are relative to `packages/tooling/delivery-automation/`. Each Sonar key belongs to exactly one unit.

### B1 — Reservation transition state machine (1 finding)

- Key: `AaHpGDeo75tUJOuwMpMU`.
- Owner: `src/control/merge-reservation.ts` (`transitionMergeReservation`).
- Approach: extract local state/event guards or explicit transition branches; retain the discriminated union, total transition contract and `null` denial result. Preserve the existing event matrix, immutability and pending-intent semantics.
- Verification: `src/control/merge-reservation.spec.ts`; relevant controller tests. Cover invalid events, pending intents, lost-response recovery and terminal proofs.

### B2 — Read-only operational state and PR identity (2 findings)

- Keys: `AaHKRr_bI6BvOb1P_iZH`, `AaHKRr_bI6BvOb1P_iZI`.
- Owner: `src/github/github-operational-state.ts`.
- Approach: extract pure candidate classification, timeline pagination checks and uniqueness predicates without relocating network authorization or changing read order. Preserve the existing result variants and read-only behavior.
- Verification: `src/github/github-operational-state.spec.ts`. Cover missing or paginated timelines, conflicting ownership, cross-repository references, stale information and partial API failures.

### B3 — Reserved integration and reconciliation (2 findings)

- Keys: `AaHpGDcm75tUJOuwMpL9`, `AaHpGDcm75tUJOuwMpL_`.
- Owner: `src/github/reserved-work-integration.ts`.
- Approach: keep operation-specific queue/arm/release/resolve handling and journal ports. Extract small private handlers or read-only checks, preserving the exact compare-and-append, authorization, observation and reconciliation order.
- Verification: `src/github/github-work-reservation-journal.spec.ts` and `src/github/run-standing-work-integration.spec.ts`. Cover candidate/check/revision mismatch, cancelled reservation, unknown remote outcome, read-back and inactive standing mode.

### B4 — Standing authority and coordinated status changes (3 findings)

- Keys: `AaHpGDcb75tUJOuwMpL8`, `AaHpGDcI75tUJOuwMpL7`, `AaHpGDc-75tUJOuwMpMF`.
- Owners: `src/github/run-coordinated-status-write.ts`, `src/github/run-standing-work-integration.ts`, `src/github/standing-work-eligibility.ts`.
- Approach: extract local snapshot-comparison and eligibility predicates only. Preserve order of journal reads, current authority rechecks, reservation guards, mutation-intent admission and final read-back. Do not relocate remote writes outside the protected controller boundary.
- Verification: `src/cli/project-status.spec.ts`, `src/github/github-work-reservation-journal.spec.ts`, `src/github/run-standing-work-integration.spec.ts`. Test revocation, invalid publisher identity, unavailable grant, receipt loss and concurrent writers.

### B5 — Merge grant, evidence, checks and final publication (4 findings)

- Keys: `AaHpGDdy75tUJOuwMpMM`, `AaGreOOMac2i5-L-YujK`, `AaGomFz87oLee45qJ_oC`, `AaGomFz87oLee45qJ_oE`.
- Owner: `src/github/work-merge-publisher.ts`.
- Approach: split complexity into file-private evidence verification, required-check/ruleset checks, candidate freshness checks and final-outcome checks. Preserve current error reasons, network read timing, exact identities and authorization rereads.
- Verification: `src/github/work-merge-publisher.spec.ts` and `src/github/github-work-reservation-journal.spec.ts`. Test missing/edited evidence, required check issuer mismatch, ruleset bypass, race, stale head/base, lost write responses and authority revocation.

## 4. Task sequencing and integration

Recommended risk-first implementation sequence: **B1 → B2 → B3 → B4 → B5**. The sequence is not a new runtime dependency. Each unit should be a reviewable batch, potentially one PR where the parent Work delivery route permits it. Work #187 remains the Work-level authority and owner; these units are not independent GitHub Project Work States.

Coordinate with Task #190: its C4/C5 localized corrections touch the same reserved-integration and merge-publisher files as B3–B5. Prefer executing structural extraction before overlapping local cleanup, or rebase and rerun relevant checks on the exact integration candidate SHA. Do not claim Sonar clearance from a non-integrated branch.

A Developer may inspect current modules/tests, choose private helper names and arrange local implementation details. The design is intentionally not a file-by-file line editing recipe.

## 5. Validation and reviews

Before accepting implementation:

1. Add or strengthen focused regression tests where current suites do not prove a refactor preserves a negative or concurrent path.
2. Run the affected delivery-automation package tests and applicable project checks: `pnpm build`, `pnpm typecheck`, `pnpm typecheck:test`, `pnpm lint`, `pnpm ci:test:tooling`, and required repository CI/Sonar analyses.
3. Record candidate SHA and CI run IDs; every Sonar issue key must be addressed on the actual candidate or receive an explicitly justified and authorized issue-level disposition.
4. Complete distinct **Code Review** (complexity, duplication, error handling, tests), **Architecture Review** (ownership and authority boundaries), **Functional Compliance Review** when behavior preservation needs external confirmation, and **Validation** (including gate, concurrency and lost-response evidence).
5. Apply the [delivery profile](../project/delivery-pipeline.md#native-work-integration) for live governance and merge authority.

If implementation would change protected remote-write order, authorization ownership, journal state or accepted outcomes, stop and return to Software Architect / appropriate owner for a revised technical target. If a material structural or governance alternative arises, follow the Project Method Profile's explicit acceptance requirements.

## 6. Readiness and current-truth synchronization

This Technical Design records an **accepted scope-bound technical target**, not effective runtime behavior. The Task #189 Readiness Review assesses whether its technical choices are sufficient; neither this file on a PR branch nor a readiness comment makes the target current. Synchronize current integration documentation when effective architecture changes. The former CI-driven integration design now records historical rationale.
