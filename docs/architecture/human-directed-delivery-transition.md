# Technical Design — Human-directed delivery transition

**Artifact status:** Proposed  
**Content status:** Approved governance target / proposed technical migration  
**Document type:** Technical Design / Governance Migration Design  
**Domain:** Delivery automation / GitHub operations

## Work context

**Work:** #31 — Simplify Task execution governance for human-directed delivery  
**Work Type:** Governance Change  
**Workflow Depth:** Complex  
**Change Characteristics:** concurrency, operational, cross-system  
**Current activity:** Designing  
**Authorized functional source:** Not applicable; this Work changes project delivery governance and repository tooling only.

**Governance authority:**

- the human Architecture Web maintainer explicitly accepted the Proposed Governance Target recorded in Work #31 comment `5527765997`;
- the acceptance is recorded in Work #31 comment `5527788609`;
- the accepted target is therefore an **Approved Target**, but it is not Current Truth until the canonical governance owner is updated and integrated.

**Canonical owners and evidence:**

- `docs/project/project-method-profile.md` — resolves `governance.delivery` and owns the human governance-acceptance rule;
- `docs/project/delivery-pipeline.md` — current owner of effective Architecture Web delivery policy;
- `docs/explorations/delivery/human-directed-task-execution.md` — non-normative exploration and dependency inventory for this Work;
- `.github/delivery-automation.json` — current repository-local external-owner activation record;
- `docs/architecture/agent-aware-delivery-activation.md` — Work #9 Technical Design and historical rationale for the current claim implementation;
- `.github/workflows/` and `packages/delivery-automation` — current implementation evidence.

## 1. Authorized constraints to preserve

The accepted governance target changes only Task execution claim/concurrency policy for the currently human-directed delivery model.

The transition MUST preserve:

- native GitHub Project `Status` as the unique operational Work State owner once activated;
- Work Type, Workflow Depth, Priority, Change Characteristic and native dependency ownership;
- Task Sub-issues as execution units without Task-level Method Work State;
- native parent relationships and Task open/closed/disposition evidence;
- the Work-level implementation WIP limit of at most one Work in `Implementing` unless a human accepts a temporary exception;
- Readiness and all applicable authority gates;
- separate Code Review, Architecture Review, Functional Compliance Review and Validation;
- Work Integration branch/PR rules;
- Work Merge Gate, Release Promotion Gate and Human Release Approval semantics;
- `agent:*` routing semantics unchanged by this Work;
- the project branch topology and normal release path;
- Work #9 history and rationale as historical evidence.

The transition MUST NOT introduce a replacement claim, lease, heartbeat, Task lifecycle, hidden active-Task field or mandatory assignee convention.

## 2. Governance target

Once #31 becomes effective, Architecture Web delivery is human-directed for Task execution:

1. a Work reaches `Ready` through the normal Readiness process;
2. delivery capacity pulls the Work and records `Implementing`;
3. when Tasks exist, a human selects an executable Task from the authorized Task plan;
4. Task dependencies establish semantic ordering and constrain permitted execution;
5. independent Tasks may be performed in any order or in parallel when the authorized Task plan and dependencies permit it;
6. assignees may communicate responsibility or visibility but do not own exclusivity, lifecycle or execution authority;
7. no Work-scoped Task execution claim is required;
8. autonomous Task selection/dispatch is not an active project requirement and receives no implied authority from this simplification.

This removes the project-wide V1 invariant that exactly one implementation Task may be active within a Work. It does **not** remove the Work-level WIP limit.

## 3. Responsibility boundaries

This change has three distinct owners and must not collapse them into one migration step.

### 3.1 Governance owner

`docs/project/delivery-pipeline.md` owns the effective rule. It must stop requiring:

- Work-scoped Task execution claims;
- claim acquisition/release for human execution;
- universal Task serialization inside one Work;
- mixed human/automated fail-closed logic based on claim state;
- activation of an active Task execution-claim mechanism as a prerequisite of ordinary delivery.

It must establish the accepted human-directed Task execution rule instead.

### 3.2 Activation record

`.github/delivery-automation.json` records whether external mechanisms are active. When the governance change becomes effective, it MUST NOT continue to claim that `taskClaim` is an effective external owner.

For the #31 governance transition, the existing schema remains version `1` and the `taskClaim` key is retained temporarily with:

```json
{
  "status": "inactive"
}
```

This is a deliberate compatibility bridge. The current parser already supports inactive mappings, so the governance transition does not need to change the manifest schema merely to stop representing claim state as effective.

Removal of the `taskClaim` key from the manifest contract, including any schema-version change, belongs to the downstream technical cleanup.

### 3.3 Implementation cleanup

The claim workflow, claim-specific code/tests, Project fields and claim-dependent automated Task-dispatch surfaces are implementation evidence, not governance owners. They become obsolete after the governance owner is effective and `taskClaim` is inactive.

Their physical removal belongs to a follow-up Technical Change so the project does not depend on the old claim rule while trying to remove the implementation of that same rule.

## 4. Transition topology

The migration uses two Works rather than one all-at-once implementation.

### Stage A — Work #31: governance adoption and deactivation

#31 owns:

- the canonical `docs/project/delivery-pipeline.md` change;
- the repository-local activation synchronization from `taskClaim = verified` to `taskClaim = inactive`;
- this Technical/Governance Migration Design;
- the Work #31 Exploration conclusion;
- an applicability note on Work #9 Technical Design sufficient to prevent its claim-specific target from being mistaken for the new effective policy after #31 is integrated.

#31 does **not** need to delete the five Project claim fields or claim implementation before its governance rule can become effective.

The Work remains a Governance Change. Its primary integration result is an accepted governance owner change, not a speculative autonomous-executor redesign.

### Stage B — follow-up Technical Change: remove obsolete claim implementation

A separate Technical Change should remove and synchronize:

- Project fields `Active Task`, `Execution Claimant`, `Execution Claim Generation`, `Execution Claim Run`, `Execution Claim Acquired At` after a live re-read proves no meaningful active/partial record is being discarded;
- `taskClaim` from the activation manifest contract, with an explicit decision on schema versioning;
- `.github/workflows/delivery-task-claim.yml`;
- claim-only package scripts and source files;
- claim-only tests;
- claim-specific branches of mixed activation/coordinator/operational-state code;
- autonomous `task-dispatch` coordinator surfaces that exist only for the deferred autonomous execution model;
- any package/current-architecture wording that materially describes removed responsibilities.

The follow-up Work must preserve Ready Queue observation, Project inventory, Work State/classification mappings, dependency/WIP logic, Work Integration target authorization, Work Merge Gate, Release Promotion Gate, Human Release Approval handling and generic validation unless its own design establishes another reason to change them.

## 5. Why the transition is split

The Current Truth requires a Task claim before implementation Task execution, while the current manual claim publisher is not operationally dispatchable until its workflow exists on the repository default branch.

Trying to perform claim-removal implementation Tasks before the governance rule changes would recreate the bootstrap problem that triggered #31.

The split avoids inventing an undocumented exception:

```text
Current governance
    |
    | human governance acceptance already exists
    v
#31 governance adoption
    |- delivery-pipeline becomes human-first
    |- taskClaim activation becomes inactive
    v
New Current Truth
    |
    v
Follow-up Technical Change
    |- remove obsolete workflow/code/tests/fields
    |- simplify manifest/schema and coordinator implementation
```

No force update, branch-topology change, hidden exception or temporary replacement lock is required.

## 6. Task planning for Work #31

#31 should remain a single coherent Governance Work rather than manufacturing implementation Sub-issues solely to satisfy ceremony.

Its repository change is one tightly coupled governance transition: canonical policy + activation-state deactivation + design/applicability synchronization. Splitting these into implementation Tasks before the new governance rule is effective would create the very Task-claim dependency the Work is removing.

The downstream technical cleanup is independently verifiable and materially larger; it therefore receives its own Work and Task Planning after #31 becomes effective.

## 7. Data and operational state

### 7.1 Project claim fields

The five Project fields remain physically present through Stage A. Their presence no longer makes them an operational owner after:

- `docs/project/delivery-pipeline.md` no longer assigns ownership to a claim mechanism; and
- `.github/delivery-automation.json` records `taskClaim` as inactive.

Before Stage B deletes them, the Project must be re-read live. Any populated or partial claim record must be explicitly assessed and cleared/migrated as operational cleanup evidence rather than silently discarded.

### 7.2 Manifest compatibility bridge

Stage A intentionally keeps schema v1. `taskClaim: inactive` is representable by the current parser and avoids mixing governance adoption with a manifest-contract migration.

Stage B decides whether removing the key warrants schema v2. Because the existing parser requires exact mapping keys, physical key removal cannot safely precede corresponding code/parser changes.

## 8. Flows and contracts

### Human Task selection after #31

```text
Work Status = Implementing
        |
        v
inspect authorized Task plan
        |
        v
select an open, dependency-unblocked Task
        |
        v
perform authorized work on the Work integration path
        |
        v
record Task completion/disposition
        |
        v
select next eligible Task when needed
```

There is no claim acquisition/release step.

### Automated execution

No new automated Task-dispatch contract is introduced by #31. Existing `agent:*` labels remain route metadata only. A future autonomous executor requires a separate accepted Work to define its selection, concurrency, recovery, security and scheduling model.

## 9. Concurrency and idempotency

The accepted target intentionally removes a global Task-level concurrency protocol.

Concurrency is governed by:

- Work-level WIP;
- explicit Task dependencies;
- the authorized Task plan;
- normal Git branch/merge conflict handling;
- review and validation at the Work boundary.

The project does not assume parallel Tasks are always safe. If a specific Work requires serialization for semantic or technical reasons, its Task dependencies or Technical Design must express that need for that Work rather than relying on a universal claim mechanism.

## 10. Security and permissions

Removing claims reduces privileged Project mutation surface because ordinary human Task execution no longer needs the Projects credential merely to acquire/release a lock.

Stage A does not expand any credential permission.

Stage B should remove claim-specific privileged mutation paths and verify that:

- remaining workflows retain least privilege;
- Projects credentials remain only where current Project owners must be read or mutated;
- gate publisher privilege separation remains unchanged;
- deletion of the claim workflow does not remove unrelated repository/gate validation.

`agent:*` route mutation authority remains unchanged.

## 11. Migration and compatibility

The transition must preserve truthful Current State throughout:

1. Human Governance Acceptance already establishes the Approved Target.
2. #31 prepares the canonical policy change and records `taskClaim` inactive in the same governed integration change.
3. Until that integration occurs, the old delivery policy remains Current Truth.
4. After integration, human-first delivery is Current Truth and claim state is no longer an active external owner.
5. Obsolete claim implementation may still physically exist temporarily, but it is non-authoritative and must not be used as a substitute owner.
6. The follow-up Technical Change removes the obsolete implementation and Project fields.
7. Work #9 records remain historical evidence; only applicability/current-target wording is synchronized.

This is an intentional short compatibility period, not a second supported delivery mode.

## 12. Failure handling

Stage A must fail rather than integrate if:

- the canonical policy still contains contradictory mandatory-claim language;
- `taskClaim` remains `verified` while the policy says the claim mechanism is no longer active;
- the change accidentally modifies `agent:*` routing semantics;
- Work-level WIP, authority, review, validation, merge or release rules are weakened;
- the Work #9 applicability note rewrites historical evidence rather than marking supersession;
- validation detects a broken manifest/parser contract.

Stage B must stop before Project field deletion if live state cannot be read or if an active/partial claim value cannot be safely explained and cleared.

## 13. Validation strategy

### Stage A / Work #31

Minimum evidence:

- governance diff review proving the change matches accepted comment `5527765997` and introduces no additional policy semantics;
- search/inspection proving no mandatory claim/concurrency rule remains in the effective delivery owner;
- manifest parse/tests proving `taskClaim: inactive` remains valid under schema v1;
- confirmation that Ready Queue, Work-level WIP, Work State, dependencies, Work/Release gates and release policy are unchanged;
- documentation relative-link/path validation;
- `pnpm format:check`;
- `git diff --check`;
- package/repository tests affected by the manifest activation change;
- Governance Review and Architecture/Security-Operational review focused on authority, activation truthfulness and privilege boundaries.

### Stage B / follow-up Technical Change

Minimum evidence should include build, typecheck, test typecheck, lint, tests, formatting and whitespace checks, plus focused tests for remaining activation/Ready Queue/gate behavior and live Project cleanup evidence.

## 14. Technical alternatives and trade-offs

### A. Remove everything in #31 before policy integration

Rejected. It requires operating under the very claim rule being removed and recreates the default-branch bootstrap problem.

### B. Keep the claim subsystem indefinitely but mark it optional

Rejected. The accepted target explicitly avoids preserving speculative lock/lease infrastructure for a future autonomous executor requirement that does not currently exist.

### C. Replace the claim with mandatory assignee/issue-comment `Active Task` convention

Rejected. This would recreate a second Task ownership protocol without a present correctness need.

### D. Change `taskClaim` directly from verified to removed in schema v1

Rejected for Stage A. The current parser requires an exact mapping key set. Marking the mapping inactive is a smaller truthful transition; structural manifest cleanup belongs with the code migration.

### E. Split governance adoption from technical cleanup

Selected. It preserves owner authority, avoids bootstrap circularity, provides a truthful compatibility bridge and gives the larger destructive cleanup its own Technical Change/Readiness boundary.

## 15. ADR assessment

No ADR is triggered by #31.

The change removes a speculative coordination mechanism and simplifies project delivery governance. It does not establish a durable structural application architecture decision with alternatives that need a separate long-lived rationale owner. The accepted governance record, this migration design, Work #9 historical rationale and Git history are sufficient.

Re-evaluate the ADR trigger only if a future autonomous-executor design introduces a durable external coordination service, persistent distributed scheduler/lease architecture or another structural system boundary.

## 16. Risks and resolved decisions

### Resolved

- **R-01 — bootstrap circularity:** resolved by separating governance adoption from claim implementation cleanup.
- **R-02 — manifest truthfulness:** resolved for Stage A by changing `taskClaim` from `verified` to `inactive` while retaining schema v1.
- **R-03 — accidental scope expansion into agent routing:** resolved by explicitly preserving `agent:*` semantics.
- **R-04 — replacement hidden lock:** resolved by rejecting mandatory assignee/comment/Task-status substitutes.
- **R-05 — Work #9 historical rewrite:** resolved by applicability/supersession annotation only.

### Remaining implementation risk for Stage B

- live Project #3 claim-field values cannot be assumed from repository evidence and must be read immediately before destructive cleanup.

This risk is non-blocking for Stage A because #31 does not delete the fields.

## 17. Work #9 applicability

After #31 becomes effective, claim-specific parts of `docs/architecture/agent-aware-delivery-activation.md` remain historical rationale for Work #9 but are no longer an effective target for current delivery.

The document should receive a concise applicability note referencing Work #31. It must not be rewritten as though Work #9 never implemented claims.

Non-claim parts of Work #9 remain applicable where still consistent with current policy, including deterministic Project inventory, Work State activation, Ready Queue observation, Work Integration target verification, gate evaluation/publication and privilege separation.

## 18. Follow-up Work trigger

After #31 is integrated and the human-first rule is Current Truth, create one follow-up **Technical Change / Complex** Work for obsolete claim implementation removal.

Expected Change Characteristics:

- `char:cross-system`;
- `char:operational`;
- `char:concurrency` while removing concurrency machinery;
- `char:destructive` because live Project fields and workflow/code paths will be deleted;
- `char:security` because privileged workflow/credential surfaces are reduced.

That Work should create focused implementation Tasks after its Technical Design is sufficient and should pass formal Readiness before destructive cleanup.

## 19. Readiness inputs for #31

#31 is ready for Task Planning / Readiness assessment when the branch contains:

- this migration design;
- the accepted governance record in Work #31;
- an Exploration conclusion matching the accepted target;
- a prepared canonical `delivery-pipeline.md` diff matching the accepted target;
- `taskClaim` prepared as inactive in the activation manifest;
- a Work #9 applicability note that preserves historical rationale;
- no unresolved decision about Stage A scope.

Project-backed Work Type / Workflow Depth / Work State remain operational Project subjects and must be synchronized according to the delivery profile before lifecycle transitions are treated as recorded Current State.
