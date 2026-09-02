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
for removal or deactivation rather than being retained as unused Current Truth.

## 6. What this candidate would *not* remove

Removing claims does not imply removing:

- Work State;
- Work Type or Workflow Depth;
- Priority;
- Task Sub-issues;
- native Task dependencies;
- human assignees;
- Readiness;
- Functional Approval where applicable;
- Code Review, Architecture Review, Functional Compliance Review, or Validation;
- Work-level WIP policy;
- branch and Pull Request governance;
- release governance.

The claim mechanism is therefore separable from most of the existing delivery
model.

## 7. `agent:*` routing

`agent:*` routing should be evaluated separately from claim removal.

Possible outcomes:

- keep the namespace because it is a lightweight future execution-route marker;
- deactivate it until a real non-human executor exists;
- remove it together with the speculative autonomous-execution machinery.

No conclusion is established yet. Claim removal does not technically require a
routing decision, so this Exploration should avoid coupling the two unless the
owner analysis shows they cannot be separated cleanly.

## 8. Impact inventory to complete

The Exploration must inspect and classify every current dependency on Task claim
state across:

- `docs/project/delivery-pipeline.md`;
- `docs/project/project-method-profile.md` where authority semantics are relevant;
- `docs/architecture/agent-aware-delivery-activation.md`;
- `.github/delivery-automation.json`;
- `.github/workflows/delivery-task-claim.yml`;
- other delivery workflows that consume claim state;
- `packages/delivery-automation` claim domain/application/infrastructure code;
- delivery automation tests;
- Project #3 claim-related fields and views;
- Work #9 completion/activation evidence;
- `AGENTS.md` instructions if they reference claim-dependent execution rules.

Each item should be classified as one of:

- policy to change;
- implementation to remove/deactivate;
- historical rationale to preserve;
- unaffected Current Truth;
- future concern to defer.

## 9. Governance implications

Changing the requirement that human executors acquire Task claims is a Material
Governance Change because `docs/project/delivery-pipeline.md` currently owns that
rule.

Exploration may recommend a target, but the target cannot become accepted policy
without explicit human Architecture Web governance acceptance under the Project
Method Profile.

If accepted, repository-owned governance should be changed once in the canonical
owner. Implementation and activation metadata must then be synchronized so they
no longer report removed claim mechanisms as effective Current Truth.

## 10. Preliminary recommendation

Prefer the human-first candidate unless the remaining impact inventory identifies
a present requirement that cannot be satisfied by existing Work State,
dependencies, assignees, branch/PR flow, review, validation, and human delivery
coordination.

Do not replace the current claim mechanism with another lock/lease/scheduler
system during this Work unless a concrete present requirement is established.

If autonomous executors become an accepted future requirement, open a separate
Governance/Technical Design Work based on the actual executor, concurrency,
security, recovery, and scheduling requirements that exist at that time.

## 11. Open questions

1. Does any current non-autonomous workflow require claim state for correctness,
   rather than merely because Work #9 implemented it?
2. Is Work-level WIP = 1 sufficient for the current single-human operating model,
   or is any additional Task-level coordination rule useful?
3. Should Task assignees be treated only as visibility, or should human selection
   have a lightweight operational convention?
4. Should `agent:*` routing remain activated when no autonomous executor is
   accepted?
5. Which Project #3 claim fields can be safely removed after governance acceptance,
   and what evidence is required before activation metadata changes from
   `verified`?
6. Which Work #9 Technical Design sections should remain as Historical Rationale
   versus being explicitly marked as no longer effective target/current behavior?
