# Human-directed Task execution

> **Artifact:** Exploration
>
> **Work:** #31 — Simplify Task execution governance for human-directed delivery
>
> **Status:** Active
>
> This document is non-normative. It records evidence, hypotheses, alternatives,
> and open questions. It does not change `governance.delivery` or supersede the
> current delivery profile.

## 1. Question

Architecture Web currently requires a Work-scoped Task execution claim before a
human or automated executor begins implementation Task execution, and V1
serializes active implementation Tasks within one Work.

The project currently uses human-directed delivery and has no accepted near-term
requirement for an autonomous coding-agent runtime that independently selects and
executes Tasks.

The question is whether the current claim/concurrency mechanism solves a present
project need or is premature infrastructure for a hypothetical future execution
model.

## 2. Current Truth

The current delivery profile establishes these rules:

- Tasks are execution units, not independent Works;
- implementation Tasks within one Work are serialized in V1;
- a human or automated executor must establish a Work-scoped Task execution
  claim before beginning Task execution;
- automated dispatch must fail closed when an active claim cannot be excluded;
- the concrete claim mechanism belongs to downstream Technical Design.

The current implementation evidence includes:

- Project-backed claim state represented by fields including `Active Task`,
  `Execution Claimant`, `Execution Claim Generation`, `Execution Claim Run`, and
  `Execution Claim Acquired At`;
- `.github/delivery-automation.json` reporting `taskClaim` as verified;
- `.github/workflows/delivery-task-claim.yml` as a manual claim publisher;
- claim acquisition/release logic in the private delivery-automation package;
- Work #9 Technical Design describing claim generation, serialization,
  acquisition, release, and recovery rules.

These remain Current Truth until governance changes are accepted and made
effective.

## 3. Triggering evidence

During Work #24 / Task #25 preparation, normal human-directed implementation was
blocked by the requirement to acquire a Task claim.

The current publisher uses GitHub `workflow_dispatch`. GitHub requires manually
dispatched workflows to be defined on the repository default branch before they
can be dispatched. Architecture Web's default branch is `main`, while ordinary
Work integrates through `development`.

This creates a bootstrap/coupling problem for the current implementation: a
mechanism intended to coordinate Task execution can itself prevent ordinary
human Task execution until delivery automation is promoted to `main`.

This constraint comes from the selected GitHub Actions mechanism, not from a
fundamental Method requirement.

## 4. Present need assessment

### Present actors

Current accepted execution is human-directed. A human selects the Work and Task,
performs or directs implementation, and uses the existing branch / Pull Request /
review / validation process.

No accepted present requirement has been identified for:

- autonomous Task selection;
- multiple autonomous executors competing for Tasks;
- machine-owned leases or heartbeats;
- automatic recovery of abandoned autonomous execution;
- distributed scheduling across executor runtimes.

### Problem currently solved by claims

The claim mechanism prevents two implementation Tasks within the same Work from
being treated as concurrently active and gives an automated coordinator a
machine-readable lock.

For a single human-directed executor, the same practical coordination can be
achieved by explicit human Task selection, native Task dependencies, assignees,
and the parent Work lifecycle without maintaining a machine lease protocol.

### Preliminary finding

The current claim system appears disproportionate to the currently accepted
execution model. This is a preliminary Exploration finding, not an accepted
policy change.

## 5. Candidate target A — human-first delivery

A simpler candidate model is:

1. a Work becomes `Ready` through the normal Method Readiness process;
2. delivery capacity pulls the Work and moves it to `Implementing`;
3. the human chooses an unblocked Task from the authorized Task plan;
4. the Task may use native GitHub assignee information for visibility, but no
   Task-level lifecycle or lease is required;
5. implementation proceeds on the normal Work branch / Pull Request path;
6. Task completion is represented by its native Sub-issue disposition;
7. dependencies determine semantic ordering;
8. review and validation remain separate gates/evidence activities;
9. autonomous/concurrent executor coordination is deferred until a concrete
   requirement exists.

Under this candidate, the following concepts would not be active delivery state:

- `Active Task`;
- `Execution Claimant`;
- `Execution Claim Generation`;
- `Execution Claim Run`;
- `Execution Claim Acquired At`.

The claim publisher workflow and related implementation would also be candidates
for removal rather than being retained as unused Current Truth.

## 6. What this candidate would not remove

Removing claims does not imply removing:

- Work State;
- Work Type or Workflow Depth;
- Priority;
- Task Sub-issues and native parent relationships;
- native Work/Task dependencies;
- human assignees;
- Readiness;
- Functional Approval where applicable;
- Code Review, Architecture Review, Functional Compliance Review, or Validation;
- Work-level WIP policy;
- Work Integration branches and Pull Requests;
- Work Merge Gate or Release Promotion Gate semantics;
- release governance.

The claim mechanism is therefore separable from most of the existing delivery
model.

## 7. `agent:*` routing

`agent:*` routing is technically separable from claim removal.

The current claim path consumes route state, especially to distinguish human and
automated acquisition, but Ready Queue routing exists independently. Removing the
claim mechanism therefore does not require an immediate decision about the route
namespace.

Possible later outcomes remain:

- keep the namespace as a lightweight execution-route marker;
- deactivate it until a real non-human executor exists;
- remove it in a separate simplification Work.

This Exploration does not silently choose among those outcomes.

## 8. Completed dependency inventory

This inventory uses `development` as repository Current Truth and classifies the
claim-dependent surface by ownership and coupling.

### 8.1 Canonical delivery policy

**Owner:** `docs/project/delivery-pipeline.md`

Claim-dependent Current Truth includes:

- `Execution routing and Task execution` language that distinguishes human and
  automated Task execution;
- the complete `V1 Task execution concurrency` subsection;
- the rule that every human or automated executor must acquire/release a claim;
- the rule that a second Task cannot begin while another claim is active;
- the mixed-human/automated fail-closed rule when Task activity cannot be
  established;
- automation constraints that forbid assuming a mixed human/automated Work is
  idle without reliable Task activity state;
- deterministic-control-plane language that includes Task dispatch eligibility;
- runtime-neutrality activation language that lists an active Task execution
  claim mechanism as a separately activated capability.

**Classification:** policy to change if the human-first target is accepted.

The surrounding Task Sub-issue, dependency, Work State, Work-level WIP,
branch/PR, review, validation, merge-gate, and release rules are not claim-owned
and should remain Current Truth unless another Work changes them.

### 8.2 Project Method Profile

**Owner:** `docs/project/project-method-profile.md`

No claim field or concurrency mechanism is defined here. This document supplies
the governance authority rule: a material change to `governance.delivery`
requires explicit human governance acceptance.

**Classification:** unaffected Current Truth; no claim-specific content change
is currently indicated.

### 8.3 GitHub Project claim fields

The implementation defines five Work-item text fields as the claim storage
contract:

- `Active Task`;
- `Execution Claimant`;
- `Execution Claim Generation`;
- `Execution Claim Run`;
- `Execution Claim Acquired At`.

Activation verification requires each field to exist exactly once and to be a
`TEXT` field. Runtime activation revalidation also fails closed if a verified
claim field disappears.

The standard Project view verifier does **not** require these fields to be visible
in Backlog, Ready Queue, Workflow, Active, Waiting, or Done views. The normal
Project delivery baseline separately requires `Status`, `Work Type`, `Workflow
Depth`, `Priority`, views, and labels.

Latest recorded Work #9 activation evidence states that activation verification
passed. The current connector session cannot independently re-read live Project
#3 field/value state, so implementation of any cleanup must re-read the Project
before deleting fields.

**Classification:** implementation/operational state to remove after governance
acceptance, subject to migration evidence that no meaningful active/partial claim
value is being discarded.

### 8.4 Activation manifest

**File:** `.github/delivery-automation.json`

Current manifest records `taskClaim` as `verified` with the same activation
evidence reference as the other mappings.

**Code coupling:**

- `config/activation-manifest.ts` makes `taskClaim` a mandatory manifest mapping
  and a Project-backed mapping;
- `operationalOwnerActivation()` exposes `taskClaim` as a runtime boolean;
- `activationBlockers()` treats an inactive claim mapping as a control-plane
  blocker;
- `config/activation-context.ts` revalidates all five claim fields when the
  mapping is verified;
- `config/activation-verification.ts` refuses full activation when those fields
  are absent or invalid.

**Classification:** update. If claim is removed from accepted delivery policy,
`taskClaim` should not remain as a required or verified mapping. The manifest
schema/validation must be synchronized deliberately; a schema-version bump
should be considered if removing a required key changes the external manifest
contract.

### 8.5 Activation-state ambiguity discovered

There is an important semantic ambiguity in Current Truth:

- `.github/delivery-automation.json` says `taskClaim = verified`;
- the activation verifier proves this mapping primarily by verifying the five
  claim storage fields;
- Work #9 and its Technical Design state that the manual claim publisher remains
  operationally unavailable until its `workflow_dispatch` definition exists on
  the default branch and a live dispatch succeeds.

Therefore `taskClaim = verified` does not establish that the end-to-end
acquire/release mechanism is operational. In practice the mapping name compresses
at least two capability states: **claim storage** and **claim mutation/publisher**.

If claims were retained, this ambiguity would require correction so activation
state cannot overstate availability. Under the human-first candidate, removing
the claim mapping and mechanism resolves the ambiguity instead of adding more
activation-state machinery.

### 8.6 GitHub workflows

#### Remove if the human-first target is accepted

- `.github/workflows/delivery-task-claim.yml`

This workflow exists solely to acquire/release Task claims. It owns the
Work-scoped GitHub Actions concurrency group, accepts claim/generation/run inputs,
requires the Projects credential, validates the trusted control ref, and invokes
the claim CLI.

#### Update

- `.github/workflows/delivery-coordinator-dry-run.yml`

Its `ready-queue` observation is independent of claim state, but its
`task-dispatch` mode reads a Task dispatch candidate whose eligibility currently
requires an idle claim. If autonomous Task dispatch is explicitly deferred, the
`task-dispatch` mode is a candidate for removal while keeping independent Ready
Queue observation if still useful.

#### Keep as independent Current Truth

- `.github/workflows/delivery-work-merge-gate.yml`;
- `.github/workflows/delivery-release-promotion-gate.yml`;
- `.github/workflows/delivery-automation-validation.yml`.

The Work Merge live-evidence path reads Work State, dependency state, the Work
Integration PR target, exact head SHA, and PR mergeability; it does not consume
Task claim state. Release promotion is a separate release-governance boundary.
The validation workflow runs repository/package validation generically and does
not contain a claim-specific validation step.

### 8.7 `@architecture/delivery-automation` package

The package must **not** be deleted wholesale. It contains independent inventory,
activation, Work selection, target authorization, Work Merge Gate, Release
Promotion Gate, and Check Run publication responsibilities.

#### Claim-only production files — remove candidate

- `src/cli/task-claim.ts`;
- `src/cli/claim-reconcile-plan.ts`;
- `src/control/task-claim.ts`;
- `src/github/task-claim-publisher.ts`;
- `src/github/task-claim-target.ts`;
- `src/github/claim-reconciliation.ts`.

These files model, parse, acquire, release, target, or reconcile claim state and
have no independent current responsibility once the claim concept is removed.

#### Package scripts — update

`package.json` currently exposes:

- `claim`;
- `claim:reconcile-plan`.

These scripts should be removed with the claim implementation. Other package
scripts remain independently meaningful.

#### Mixed files — update, not delete wholesale

- `src/config/activation-manifest.ts` — remove the required `taskClaim` mapping
  and Project-backed activation coupling;
- `src/config/activation-context.ts` — remove claim-field drift validation;
- `src/config/activation-verification.ts` — remove required claim-field
  verification and `CLAIM_FIELDS_MISSING_OR_INVALID`;
- `src/control/eligibility.ts` — claim state, claim blockers, and claim
  acquisition evaluation are intertwined with otherwise independent Work/Task,
  dependency, WIP, route, and target checks;
- `src/control/coordinator.ts` — Task dispatch plans currently expose
  `claimRequired`; Ready Queue planning is independent;
- `src/github/github-operational-state.ts` — Project/Work reading, WIP,
  dependencies, Task parent state, routes and Work Integration PR resolution are
  broader than claims, but Task dispatch currently derives `claimState` from the
  parent Work;
- `src/cli/coordinator-dry-run.ts` — `task-dispatch` mode consumes the
  claim-dependent candidate; `ready-queue` mode is independent;
- `src/cli/coordinator-dispatch.ts` — automated Task dispatch authorization
  consumes the claim-dependent Task candidate. Because no production autonomous
  executor is currently accepted, this executable surface is a strong candidate
  to defer/remove rather than redesign around a replacement claim mechanism.

#### Files currently unaffected by claim removal

The inventory found no claim dependency requiring removal from the core gate
paths, including:

- Project inventory/read primitives;
- delivery baseline expectations for `Status`, classification, Priority, views,
  and labels;
- Work Integration target resolution;
- Work Merge Gate evaluation/publication;
- Release Promotion Gate evaluation/publication;
- Human Release Approval record handling;
- generic Check Run publication.

Those responsibilities should remain unless separately reviewed.

### 8.8 Tests

Tests split into two groups.

#### Claim-only tests — remove with claim implementation

- `src/control/task-claim.spec.ts`;
- `src/github/claim-reconciliation.spec.ts`;
- `src/github/task-claim-publisher.spec.ts`;
- `src/github/task-claim-target.spec.ts`.

These tests prove claim parsing, partial-state handling, generation protection,
publication, release/reconciliation, and claim target resolution. They become
obsolete if the capability is intentionally removed.

#### Mixed tests — update while retaining independent assertions

- `src/config/activation-manifest.spec.ts`;
- `src/config/activation-context.spec.ts`;
- `src/config/activation-verification.spec.ts`;
- `src/control/eligibility.spec.ts`;
- `src/control/coordinator.spec.ts`;
- `src/github/github-operational-state.spec.ts`.

These suites currently construct verified claim mappings/fields or assert claim
blockers alongside independent lifecycle, classification, dependency, WIP,
route, Task parent, target, and Project behavior. Claim-specific cases should be
removed while preserving the independent cases.

The existing repository-level validation commands in
`docs/development/testing.md` remain applicable. That document does not define a
claim-specific testing policy and therefore does not require a claim-driven
semantic rewrite.

### 8.9 Work #9 Technical Design

**File:** `docs/architecture/agent-aware-delivery-activation.md`

Claim-dependent target/design content includes:

- Work #9 in-scope responsibility for Work-scoped claim storage and trusted
  mutation;
- constraints requiring one active implementation Task per Work and reliable
  mixed human/automated ownership;
- Task execution planning step requiring no conflicting active claim;
- stable claim blockers;
- the full `Task execution claim` section;
- claim-specific security/publisher considerations;
- activation sequence step for claim storage/acquire/release/recovery;
- claim-specific validation requirements;
- D-02 (`no automatic claim expiry`);
- D-06 insofar as default-branch bootstrap applies to the claim publisher;
- D-07 (explicit human/automated claim execution kind);
- Work #9 completion criteria and follow-up research references that mention
  claim integration.

The document also contains substantial non-claim design for inventory, Work State
activation, Ready Queue observation, target authorization, gate publication,
release approval, credential separation, and fail-closed behavior.

**Classification:** update applicability, preserve history. Do not rewrite Work
#9 as though the claim design never existed. After an accepted #31 target becomes
effective, add a clear supersession/current-applicability note identifying which
claim-related parts are no longer effective target/current behavior. Git and the
closed Work #9 record preserve the implementation rationale and evidence.

### 8.10 Work #9 Issue, PR, review and validation evidence

Work #9 is closed as completed and explicitly records the implemented claim
review correction, activation evidence, PR/CI evidence, and default-branch
bootstrap limitation.

**Classification:** Historical Rationale / implementation evidence. Preserve the
closed Work, PR, reviews, comments, and commits. Do not rewrite them into the new
policy. A later cross-reference to #31 may be added for discoverability if useful,
but history itself is not a Current Truth owner to edit away.

### 8.11 Other canonical documentation

- `AGENTS.md` does not currently define the Task claim protocol. Its separate
  Work State ownership ambiguity remains owned by Task #25 and should not be
  conflated with #31.
- `docs/development/testing.md` contains generic validation policy, not claim
  semantics.
- current architecture/package documentation describes
  `@architecture/delivery-automation` as private repository tooling without
  making the claim subsystem the package's identity.

**Classification:** no claim-specific change required merely to remove claims,
except normal Current Architecture synchronization if implementation changes
materially alter the documented package responsibility.

## 9. Classification summary

| Surface | Classification | Proposed treatment if human-first target is accepted |
| --- | --- | --- |
| Delivery claim/concurrency policy | Change | Replace mandatory Task claim/serialization rules with human-directed Task selection and dependency ordering |
| Five Project claim fields | Remove | Re-read live values, migrate/clear safely, then remove fields |
| `taskClaim` activation mapping | Remove/change | Stop representing claim as an activated mapping; synchronize manifest schema |
| Claim publisher workflow | Remove | Delete `delivery-task-claim.yml` |
| Claim-only package code/scripts | Remove | Delete claim model/publisher/target/reconciliation and scripts |
| Mixed activation/coordinator/state code | Update | Remove claim coupling; retain independently useful behavior |
| Claim-only tests | Remove | Delete obsolete claim behavior tests |
| Mixed tests | Update | Remove claim fixtures/assertions; retain lifecycle/dependency/WIP/target tests |
| Work/Release gate workflows and code | Keep | Independent Current Truth |
| Project lifecycle/classification fields and standard views | Keep | Independent Current Truth |
| Task Sub-issues / dependencies / assignees | Keep | Human-directed execution primitives |
| Work-level WIP = 1 | Keep for now | Sufficient current concurrency bound unless separately changed |
| `agent:*` routing | Defer separate decision | Claim removal does not technically require route removal |
| Work #9 Technical Design | Preserve + mark supersession | Keep historical rationale; mark claim portions no longer effective after #31 becomes Current Truth |
| Work #9 Issue/PR/review/CI evidence | Preserve history | Do not rewrite completed evidence |
| Project Method Profile | Keep | Continues to own governance acceptance rule |
| Testing policy | Keep | Existing validation commands remain applicable |

## 10. Migration constraints if the target is accepted

Implementation should avoid leaving a half-removed control plane.

A safe migration should establish at least:

1. explicit human governance acceptance for the new delivery rule;
2. live re-read of Project #3 claim fields and current values;
3. explicit handling of any active or partial claim record before field removal;
4. canonical `delivery-pipeline.md` update establishing the new effective rule;
5. synchronized activation manifest/configuration so `taskClaim` is no longer
   reported as effective;
6. removal of claim publisher/code/tests and claim-specific coordinator coupling;
7. Project field cleanup after repository behavior no longer requires them;
8. Technical Design applicability/supersession update without erasing Work #9
   history;
9. repository build/typecheck/lint/test/format/whitespace validation;
10. focused Governance, Code, Architecture, Security/Operational, and Validation
    review appropriate to the changed control-plane boundary.

The ordering must be refined in Technical Design/Task Planning so Current Truth
is not temporarily represented inconsistently during integration.

## 11. Current Exploration conclusion

No present non-autonomous capability identified by this inventory requires the
Task claim state for correctness.

The claim mechanism is required by the **current policy and the automated Task
planning implementation because Work #9 deliberately made it a prerequisite**;
it is not required by Work State, Task identity, native dependencies, Work-level
WIP, branch/PR governance, review, validation, Work Merge Gate, or Release
Promotion Gate.

The strongest current justification for the claim system is future concurrent or
autonomous execution. That requirement is not currently accepted.

The inventory therefore strengthens the preliminary recommendation to adopt the
human-first target and remove, rather than merely disable indefinitely, the claim
subsystem. Future autonomous executor coordination should be designed later from
concrete executor/concurrency/security/recovery requirements.

This remains an Exploration recommendation until explicit human governance
acceptance establishes an Approved Target.

## 12. Remaining open questions before governance proposal

1. Should #31 remove only the claim subsystem while leaving `agent:*` routing
   untouched, or should routing be separately deactivated in another Work?
2. Should automated `task-dispatch` coordinator surfaces be removed in #31 as
   speculative infrastructure, or retained without an active runtime? The
   inventory recommends removal/deferment but this is broader than the five
   claim fields themselves.
3. What lightweight human convention, if any, should communicate the currently
   selected Task: native assignee only, issue comment, or no extra mechanism?
4. Should the activation manifest change be represented as a schema v2 migration
   when the mandatory `taskClaim` key is removed?
5. What is the current live Project #3 state of the five claim fields and their
   values immediately before migration?
