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

- Work #31 comment `5527765997` contains the Proposed Governance Target;
- the human Architecture Web maintainer explicitly accepted that exact target;
- Work #31 comment `5527788609` records the Human Governance Acceptance;
- the accepted target is therefore an **Approved Target**, but it is not Current Truth until the canonical governance owner is updated and integrated.

**Canonical owners and evidence:**

- `docs/project/project-method-profile.md` — resolves `governance.delivery` and owns the human governance-acceptance rule;
- `docs/project/delivery-pipeline.md` — current owner of effective Architecture Web delivery policy;
- `docs/explorations/delivery/human-directed-task-execution.md` — non-normative exploration and dependency inventory;
- `.github/delivery-automation.json` — repository-local external-owner activation record;
- `docs/architecture/agent-aware-delivery-activation.md` — Work #9 Technical Design and historical rationale for the claim implementation;
- `.github/workflows/` and `packages/delivery-automation` — current implementation evidence.

## 1. Authorized constraints to preserve

The accepted target changes only Task execution claim/concurrency policy for the currently human-directed delivery model.

The transition MUST preserve:

- native GitHub Project `Status` as the unique operational Work State owner once activated;
- Work Type, Workflow Depth, Priority, Change Characteristic and native dependency ownership;
- Task Sub-issues as execution units without Task-level Method Work State;
- native Task parent and open/closed/disposition evidence;
- the Work-level implementation WIP limit of at most one Work in `Implementing` unless a human accepts a temporary exception;
- Readiness and all applicable authority gates;
- separate Code Review, Architecture Review, Functional Compliance Review and Validation;
- Work Integration branch/PR rules;
- Work Merge Gate, Release Promotion Gate and Human Release Approval semantics;
- `agent:*` routing semantics unchanged by this Work;
- branch topology and the normal release path;
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

### 2.1 Canonical policy change to implement

The implementation change in `docs/project/delivery-pipeline.md` must remove the current `V1 Task execution concurrency` claim protocol and replace it with policy equivalent to:

> Architecture Web currently uses human-directed Task execution. When implementation Tasks exist inside an `Implementing` Work, a human selects an executable Task from the authorized Task plan. Semantic ordering and required serialization are expressed by the Task plan and activated Task dependencies. Architecture Web does not require a Work-scoped Task claim, lease, lock, heartbeat, mandatory assignee, or separate Task lifecycle for ordinary human execution. Independent Tasks may proceed in any order or in parallel only when their authorized design and dependencies permit it. The Work-level implementation WIP limit remains unchanged. Autonomous Task selection/dispatch requires a separate accepted Governance/Technical Design scope before activation.

The final canonical wording may be edited for consistency with the surrounding document, but it MUST preserve the accepted semantics above and MUST NOT introduce additional governance decisions.

Claim-dependent wording elsewhere in the same owner must also be removed or rewritten so the document contains no contradictory mandatory-claim rule.

## 3. Responsibility boundaries

### 3.1 Governance owner

`docs/project/delivery-pipeline.md` owns the effective human-first rule. It must stop requiring:

- Work-scoped Task execution claims;
- claim acquisition/release for human execution;
- universal Task serialization inside one Work;
- mixed human/automated fail-closed logic based on claim state;
- activation of a Task execution-claim mechanism as a prerequisite of ordinary delivery.

### 3.2 Activation record

`.github/delivery-automation.json` must stop representing `taskClaim` as an effective external owner when the governance rule becomes effective.

For Stage A, keep schema version `1` and retain the required key with:

```json
{
  "status": "inactive"
}
```

The current parser already supports inactive mappings. Removing the key itself would require corresponding parser/schema changes and belongs to the downstream technical cleanup.

### 3.3 Implementation cleanup

The claim workflow, claim-specific code/tests, Project fields and claim-dependent automated Task-dispatch surfaces are implementation evidence, not governance owners. Their physical removal belongs to a follow-up Technical Change after #31 is Current Truth.

## 4. Transition topology

The migration uses two Works rather than one all-at-once implementation.

### Stage A — Work #31: governance adoption and activation declassification

After Readiness, #31 implements only the tightly coupled governance transition:

- update `docs/project/delivery-pipeline.md` to the accepted human-first rule;
- change `.github/delivery-automation.json` from `taskClaim = verified` to `taskClaim = inactive` while keeping schema v1;
- add a concise applicability note to `docs/architecture/agent-aware-delivery-activation.md` stating that claim-specific design remains Work #9 historical rationale but is superseded for current delivery once #31 is effective;
- conclude the Exploration without turning it into a second normative owner.

#31 does **not** delete the five live Project fields or remove claim implementation code before the governance rule is effective.

### Stage B — follow-up Technical Change: remove obsolete implementation

After #31 is integrated, a separate Technical Change should remove and synchronize:

- Project fields `Active Task`, `Execution Claimant`, `Execution Claim Generation`, `Execution Claim Run`, `Execution Claim Acquired At`, after a live read proves no meaningful active/partial record is being discarded;
- `taskClaim` from the activation manifest contract, with an explicit schema-version decision;
- `.github/workflows/delivery-task-claim.yml`;
- claim-only package scripts, source files and tests;
- claim-specific branches of mixed activation/coordinator/operational-state code;
- autonomous `task-dispatch` coordinator surfaces that exist only for the deferred autonomous execution model;
- current package/architecture wording materially describing removed responsibilities.

The follow-up Work must preserve Ready Queue observation, Project inventory, Work State/classification mappings, dependency/WIP logic, Work Integration target authorization, Work Merge Gate, Release Promotion Gate, Human Release Approval handling and generic validation unless its own design establishes another reason to change them.

## 5. Why the migration is split

Current Truth requires Task claims for implementation Tasks, while the current manual claim publisher is not operationally dispatchable until its workflow exists on the repository default branch.

Trying to remove the claim implementation through implementation Tasks before changing the governing rule would recreate the bootstrap problem that triggered #31.

The selected sequence is:

```text
Current governance
    |
    | Human Governance Acceptance already exists
    v
Work #31
    |- adopt human-first rule in canonical owner
    |- mark taskClaim activation inactive
    |- mark Work #9 claim design superseded for current delivery
    v
New Current Truth
    |
    v
Follow-up Technical Change
    |- remove obsolete workflow/code/tests/fields
    |- simplify manifest/schema/coordinator implementation
```

No force update, branch-topology change, hidden policy exception or replacement lock is required.

## 6. Task Planning decision for #31

#31 remains one coherent Governance Work and does **not** create implementation Sub-issues for Stage A.

Reason:

- Stage A is one tightly coupled governance transition;
- its owner/configuration/applicability changes must become effective together;
- manufacturing implementation Tasks before the new governance rule is effective would make #31 depend on the Task-claim protocol it exists to remove;
- the Method/project policy does not require artificial Sub-issues merely because Workflow Depth is Complex;
- the materially larger and independently verifiable destructive cleanup is separated into the follow-up Technical Change, where Task Planning will be appropriate.

This is a Task Planning result, not an exception to the Method.

## 7. Data and operational state

### 7.1 Project claim fields

The five Project fields remain physically present through Stage A. Their presence no longer makes them an operational owner after:

- the canonical policy no longer assigns ownership to a claim mechanism; and
- `.github/delivery-automation.json` records `taskClaim` as inactive.

Before Stage B deletes them, Project #3 must be re-read live. Any populated or partial claim record must be explicitly assessed and cleared/migrated as operational cleanup evidence rather than silently discarded.

### 7.2 Manifest compatibility bridge

Stage A intentionally keeps schema v1. `taskClaim: inactive` is representable by the current parser and avoids mixing governance adoption with manifest-contract migration.

Stage B decides whether removing the key warrants schema v2. The current parser requires an exact mapping key set, so physical key removal cannot safely precede parser changes.

## 8. Execution flow after #31

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
select another eligible Task when needed
```

There is no claim acquisition/release step.

No new automated Task-dispatch contract is introduced. Existing `agent:*` labels remain route metadata only. A future autonomous executor requires separate accepted governance/design for selection, concurrency, recovery, security and scheduling.

## 9. Concurrency and consistency

The target intentionally removes a global Task-level concurrency protocol.

Concurrency is governed by:

- Work-level WIP;
- explicit Task dependencies;
- the authorized Task plan/Technical Design;
- normal Git branch/merge-conflict handling;
- review and validation at the Work boundary.

The project does not assume parallel Tasks are always safe. If a specific Work requires serialization, its Task dependencies or Technical Design must express that need rather than relying on a universal claim mechanism.

## 10. Security and permissions

Removing claims reduces privileged Project mutation surface because ordinary human Task execution no longer needs Projects credentials merely to acquire/release a lock.

Stage A expands no credential permission.

Stage B must verify that:

- claim-specific privileged mutation paths are removed;
- remaining workflows retain least privilege;
- Projects credentials remain only where active Project owners must be read or mutated;
- Work/Release gate privilege separation remains unchanged;
- deleting claim machinery does not remove unrelated validation or authority gates.

`agent:*` route mutation authority remains unchanged.

## 11. Migration truthfulness

The transition must preserve truthful state:

1. Human Governance Acceptance establishes the Approved Target.
2. Before #31 integration, the existing mandatory-claim policy and `taskClaim = verified` remain Current Truth.
3. Stage A changes canonical policy and activation representation together.
4. After Stage A integration, human-first delivery is Current Truth and claim state is no longer an active external owner.
5. Obsolete claim implementation may physically remain for a short compatibility period, but it is non-authoritative and must not be used as a substitute owner.
6. Stage B removes the obsolete implementation and fields.
7. Work #9 Issue/PR/review/CI evidence remains historical evidence; only current applicability is synchronized.

This is a one-way migration, not two supported delivery modes.

## 12. Failure handling

Stage A must fail rather than integrate if:

- mandatory-claim language remains contradictory in the canonical delivery owner;
- `taskClaim` remains `verified` while the new policy says the mechanism is inactive;
- the change modifies `agent:*` routing semantics;
- Work-level WIP, authority, review, validation, merge or release rules are weakened;
- the Work #9 note rewrites historical evidence rather than marking supersession;
- schema-v1 manifest parsing no longer accepts the intended inactive mapping.

Stage B must stop before Project field deletion if live state cannot be read or an active/partial claim value cannot be safely explained and cleared.

## 13. Validation strategy

### Stage A / Work #31

Minimum evidence:

- governance diff review proving alignment with accepted comment `5527765997` and no additional policy semantics;
- search/inspection proving no mandatory claim/concurrency rule remains in `docs/project/delivery-pipeline.md`;
- tests proving `taskClaim: inactive` remains valid under schema v1 and does not corrupt unrelated activation parsing;
- confirmation that Ready Queue, Work-level WIP, Work State, dependencies, Work/Release gates and release policy remain unchanged;
- documentation relative-link/path validation;
- `pnpm format:check`;
- `git diff --check`;
- affected package/repository tests;
- Governance Review;
- Architecture/Security-Operational review focused on owner truthfulness and privilege boundaries;
- final Validation against the integrated candidate.

### Stage B / follow-up Technical Change

Minimum evidence should include build, typecheck, test typecheck, lint, tests, formatting and whitespace checks, focused tests for remaining activation/Ready Queue/gate behavior, and live Project cleanup evidence.

## 14. Alternatives and trade-offs

### Remove everything inside #31 before policy integration

Rejected. It recreates the bootstrap circularity and expands #31 into destructive technical cleanup.

### Keep claims indefinitely as optional future infrastructure

Rejected. The accepted target explicitly avoids speculative claim/lease infrastructure for a requirement that does not exist.

### Replace claims with mandatory assignee/comment/Task-status conventions

Rejected. This would recreate a hidden Task ownership protocol without a present correctness need.

### Remove the `taskClaim` manifest key directly in Stage A

Rejected. The current parser requires the key. `inactive` is the smallest truthful compatible transition; structural schema cleanup belongs to Stage B.

### Split governance adoption from technical cleanup

Selected. It preserves owner authority, avoids bootstrap circularity, keeps the transition truthful and gives destructive cleanup its own Readiness boundary.

## 15. ADR assessment

No ADR is triggered by #31.

The change removes speculative delivery machinery and does not establish a durable structural application architecture decision requiring a separate rationale owner. The accepted governance record, this migration design, Work #9 historical rationale and Git history are sufficient.

Re-evaluate the ADR trigger if a future autonomous-executor design introduces a persistent external coordinator, distributed scheduler/lease service or another durable structural boundary.

## 16. Risks and resolved decisions

Resolved for Stage A:

- **bootstrap circularity** — Stage A changes governance without implementation Sub-issues; destructive cleanup is deferred;
- **activation truthfulness** — Stage A changes `taskClaim` to `inactive`, not removed;
- **agent-routing scope creep** — `agent:*` remains unchanged;
- **replacement hidden lock** — no mandatory assignee/comment/status substitute;
- **historical rewrite** — Work #9 gets an applicability note only.

Remaining Stage B risk:

- live Project #3 claim-field values must be read immediately before destructive cleanup.

That risk does not block Stage A because #31 does not delete those fields.

## 17. Work #9 applicability

After #31 becomes effective, claim-specific parts of `docs/architecture/agent-aware-delivery-activation.md` remain Historical Rationale for Work #9 but are no longer an effective target for current delivery.

The document must receive a concise applicability note referencing #31. It must not be rewritten as though Work #9 never implemented claims.

Non-claim parts remain applicable where consistent with current policy, including deterministic Project inventory, Work State activation, Ready Queue observation, Work Integration target verification, gate evaluation/publication and privilege separation.

## 18. Follow-up Work trigger

After #31 is integrated and human-first delivery is Current Truth, create one follow-up **Technical Change / Complex** Work for obsolete claim implementation removal.

Expected Change Characteristics:

- `char:cross-system`;
- `char:operational`;
- `char:concurrency`;
- `char:destructive` for live field/workflow/code deletion;
- `char:security` because privileged mutation surfaces are reduced.

That Work should create focused implementation Tasks after its Technical Design is sufficient and pass formal Readiness before destructive cleanup.

## 19. Readiness inputs for #31

#31 may proceed to formal Readiness when the following design/context is resolved:

- Human Governance Acceptance is recorded and unambiguous;
- this migration design is present and internally consistent;
- the Exploration inventory supports the accepted target;
- the exact canonical policy semantics to implement are specified in this design;
- Stage A scope is bounded to canonical governance adoption, activation declassification and Work #9 applicability synchronization;
- Task Planning has explicitly concluded that no Stage A implementation Sub-issues are required;
- no unresolved decision remains about `agent:*`, Work-level WIP, manifest compatibility, Work #9 history or the Stage A/Stage B split;
- validation and review evidence requirements are defined.

No canonical owner, activation manifest or implementation file needs to be mutated merely to pass Readiness. Those are Stage A implementation actions permitted only after a valid Readiness result.

Project-backed Work Type, Workflow Depth and Work State remain operational Project subjects and must be synchronized according to the delivery profile before lifecycle transitions are treated as recorded Current State.
