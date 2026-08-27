# Architecture Web — Agent-Aware GitHub Delivery Governance Proposal

> **Content status:** Proposed Target — amended after independent review  
> **Document type:** Governance proposal / working artifact  
> **Authority:** Not approved in its amended form. Not Current Truth. The previous Human Governance Approval applies only to blob `97a92896ec722e6a305e12eb7185493ca2eee522`.  
> **Intended durable owner:** `docs/project/delivery-pipeline.md` and only minimal related project-owned guidance that references it.

## 1. Purpose

This proposal extends Architecture Web's project-specific delivery policy to support human and AI execution while preserving Method authority, lifecycle, review, validation, and ownership semantics.

It defines:
- execution-route ownership;
- deterministic dispatch/orchestration boundaries;
- Work/Task integration policy;
- pre-merge enforcement;
- release-candidate ownership and release authority;
- branch/environment promotion policy;
- security invariants for privileged automation.

The durable governance MUST remain independent from a specific AI model or runtime framework.

## 2. Operational ownership additions

Once effectively activated, the following operational assignments apply:

```text
Execution route/provider       -> GitHub Issue label: agent:*
Human identity assignment      -> GitHub native assignees
Release candidate/promotion    -> top-level GitHub Issue representing the Release Work
Implementation/review vehicle  -> Pull Request
```

These assignments supplement rather than replace the existing delivery ownership mappings.

`agent:*` owns only the selected execution route/provider for the executable unit.

GitHub native assignees own human identity assignment where applicable. An assignee MUST NOT silently override `agent:*`, and `agent:*` MUST NOT be interpreted as a human identity.

A Release Work owns only the operational release objective, candidate identity/context, promotion evidence links, and release coordination. It MUST NOT become a duplicate owner of product behavior, architecture, implementation truth, or validation truth.

External ownership assignments are Current Truth only after the backing GitHub primitives exist, are usable, and have been verified under the project's activation policy.

## 3. Execution-agent routing

### 3.1 Namespace

The project MUST use the `agent:*` label namespace for execution-route/provider assignment.

The namespace MUST NOT encode:
- a concrete model;
- a Method Role;
- an agent runtime/framework;
- an approval or authority gate.

Initial or future examples may include:

```text
agent:human
agent:codex
agent:claude-code
agent:gemini
```

Each token represents a **contractual execution route/provider identifier**. A token such as
`agent:codex` names the project routing contract for Codex-capable execution; it does not
freeze a concrete model version, runtime framework, workflow implementation, or credential
mechanism.

Only labels whose project mapping has been explicitly activated are operational owners.

### 3.2 Routing cardinality

An executable Work or Task MUST have at most one active `agent:*` label.

```text
0 agent:*          -> unassigned route
1 agent:*          -> assigned route
more than 1        -> conflicting route
```

A missing route MUST NOT by itself make an otherwise valid Work State invalid and MUST NOT become a hidden Readiness Gate.

A conflicting route MUST block execution until corrected.

### 3.3 Automation eligibility

Automated dispatch requires:
- exactly one automated `agent:*` route;
- an activated runtime adapter for that route;
- an authorized target scope/ref;
- all normal Work/Task eligibility, dependency, and WIP conditions.

`agent:human` MUST NOT be automatically dispatched.

A configured route whose runtime is unavailable MUST be surfaced as an operational execution blocker; the coordinator MUST NOT silently substitute another agent.

### 3.4 Routing authority

An automated execution agent MUST NOT assign, remove, or change its own `agent:*` route.

An `agent:*` mutation may be recorded only when the route has been established by:
- explicit human delivery assignment; or
- a project policy/delegation that grants the Workflow Coordinator authority to establish or record that route.

Tool capability to edit labels does not create routing authority.

### 3.5 Method Role separation

`agent:*` selects a physical/technical executor route. It does not select the Method Role.

The active Role MUST be resolved from the current Activity and Context Manifest.

A material Activity/Role change SHOULD trigger focused context re-resolution even when the same physical agent continues execution.

## 4. Executable Work and Tasks

A lightweight Work without implementation Tasks MAY itself be the executable unit.

When Task Planning creates implementation Tasks:
- the Tasks are the executable implementation units;
- the parent Work coordinates lifecycle and scope;
- the parent Work MUST NOT implicitly provide an inherited `agent:*` route to its Tasks in V1.

When semantic ordering exists between Tasks, it MUST be represented by the project's activated dependency mechanism.

The coordinator MUST NOT infer semantic sequencing from AI preference, issue age, or arbitrary ordering.

A non-semantic tie-break MAY be implementation-defined but MUST be deterministic.

Task closure alone MUST NOT be interpreted as successful completion when its closure disposition does not satisfy the authorized Task plan.

### 4.1 V1 Task execution concurrency

V1 MUST serialize **all active Task execution within one Work**, regardless of whether the
Task is routed to a human or an automated agent.

At most one implementation Task for a Work may hold the Work's active Task execution claim
at a time.

A human or automated executor MUST establish the active Task execution claim before beginning
Task execution and MUST release or resolve that claim when execution ends, is handed off, or
reaches an accepted terminal disposition.

The Workflow Coordinator MUST NOT dispatch an automated Task for a Work while another Task
for that Work has an active execution claim, including a human-executed Task.

A human MUST NOT begin a second Task for the same Work while another Task has an active
execution claim, unless a human holding project delivery/governance authority explicitly
authorizes a bounded exception.

The exact GitHub field, relationship, lease, lock, status, or other mechanism used to record
the active Task execution claim belongs to downstream activation/Technical Design.

Until that claim mechanism is implemented and verified, automated dispatch MUST treat a Work
with mixed human/automated executable Tasks as unavailable for automated Task dispatch when
the coordinator cannot reliably establish that no human Task is active.

This rule does not create a Task-level Method Work State. It is a project delivery concurrency
constraint.

Future policy MAY broaden Task concurrency after branch isolation, conflict, validation,
claim/recovery, and failure behavior are deliberately designed and accepted.

## 5. Deterministic control plane

The delivery control plane MUST deterministically apply established project policy for:
- Work dispatch eligibility;
- Task dispatch eligibility;
- dependency checks;
- WIP enforcement;
- routing validation;
- target-ref validation;
- lifecycle transition validity;
- merge-gate evaluation;
- release-promotion prerequisite evaluation.

The control plane MAY record or act on semantic results established by the Role or Authority responsible for the underlying Activity.

It MUST NOT manufacture review acceptance, functional approval, architecture authority, validation sufficiency, Priority, release approval, or another semantic result merely from agent confidence, prose, or tool capability.

### 5.1 Ready Queue and executor-specific dispatch

Membership in the Ready Queue remains owned by the existing lifecycle and delivery-selection policy. `agent:*` MUST NOT redefine whether a Work is `Ready`.

For an automated executor, dispatch selection is a second-stage filter over otherwise eligible Ready Work:

1. start from Work whose `Work State = Ready`;
2. remove Work blocked by dependencies or WIP policy;
3. retain only Work whose activated `agent:*` route matches the available executor;
4. apply the existing Priority and deterministic tie-break policy within that executor-compatible candidate set.

A Work routed to another executor remains valid Ready Work but is not a candidate for the current executor.

The same separation applies to Task dispatch inside an eligible `Implementing` Work: Task dependency and routing eligibility constrain the executor-compatible candidate set; non-semantic tie-breaks remain deterministic.

## 6. Work integration branches and pull requests

Ordinary Work continues to branch from the project's authorized integration base.

For meaningful repository Work, the project SHOULD use one primary Work Integration Branch and one Work Integration PR per repository integration target.

Example:

```text
development
    |
    v
work/<work-id>-<slug>
```

When useful, a Task MAY use a Task branch whose integration target is the Work Integration Branch:

```text
task/<task-id>-<slug>
    |
    v
work/<work-id>-<slug>
    |
    v
development
```

Task-level integration MUST NOT be used to bypass Work-level review, validation, or merge requirements by merging partial governed Work directly to `development`.

A Work Integration PR MAY be Draft during `Implementing`.

## 7. Work Merge Gate

A Work Integration PR MUST NOT merge into its governed integration target until the Work Merge Gate passes.

For V1, Work Merge Gate evaluation occurs only while the owning Work is in `Validating`.

The Work Merge Gate is a composite project enforcement mechanism. It MUST NOT replace or manufacture Authority, Quality, or Evidence Gate results.

It may pass only when:
- the owning Work is identifiable;
- `Work State = Validating`;
- required in-scope Tasks have acceptable terminal dispositions;
- required dependency blockers are resolved;
- applicable review results have already been accepted by their responsible Roles;
- required pre-merge validation evidence is sufficient;
- applicable prior authority gates are satisfied;
- no unresolved Working Decision invalidates integration or exceeds delegated implementation authority;
- repository-required checks and mergeability requirements pass.

A passing Work Merge Gate:
- does not grant automatic merge authority;
- does not execute a human-only gate;
- does not imply `Done`.

After merge, the Work remains subject to the normal Done invariants and any applicable post-merge synchronization or validation evidence.

The Work Merge Gate applies to Work Integration PRs, including ordinary Work integrated into `development` and release-candidate correction Work integrated into an authorized `release/*` branch.

It does **not** govern the Release Work's promotion PR from `release/*` to `main`. Stable release promotion is governed by the distinct Release Promotion Gate in section 13.

## 8. Agent execution security boundary

Ordinary agent execution MUST NOT receive credentials that grant privileged GitHub repository, Project, merge, release, or governance mutations beyond the operations explicitly delegated to that execution scope.

Privileged GitHub writes MUST pass through a trusted publisher, safe-output mechanism, or equivalent separated component that:
- validates the requested operation;
- enforces scope and least privilege;
- enforces protected-file restrictions;
- preserves auditability;
- refuses unauthorized owner/gate mutations.

Workspace write access for implementation MAY be granted within authorized scope and does not itself grant GitHub platform mutation authority.

Governance, agent-control, CI/CD, credential, and other protected project files MUST NOT be modified by ordinary feature execution unless the authorized Work scope explicitly includes those files and the relevant governance/security policy permits it.

Exact runtime, secret storage, token issuance, model, reasoning effort, sandbox, and workflow syntax belong to Technical Design.

## 9. Scheduled control plane and target refs

The branch that owns a scheduled workflow does not own application branch semantics.

The deterministic control plane MUST select or validate an explicit authorized target ref before dispatch.

The target ref MUST NOT be accepted solely from untrusted agent output.

This allows a stable default-branch control plane to coordinate authorized execution against `development`, `release/*`, or another explicitly permitted target without redefining those branches.

## 10. Branch and environment policy

Branches and deployment environments are distinct delivery concepts.

The proposed normal branch topology is:

```text
main
development
release/*
```

The proposed deployment environments are:

```text
alpha
beta
production
```

The normal staged promotion path is:

```text
development -> alpha
release/*   -> beta
main        -> production
```

A permanent `staging` branch SHOULD NOT be introduced solely to represent the beta environment.

For the normal beta/stable release path, promotion to `main` SHOULD occur through the authorized short-lived `release/*` candidate rather than a direct `development -> main` promotion.

Any intentionally supported direct-promotion or emergency path MUST be defined explicitly and MUST NOT silently bypass the Release Promotion Gate.

## 11. Release Work and release candidates

A staged release MUST have one identifiable Release Work as its operational coordination owner.

A Release Work is a normal Method Work, not a new Work Type.

For a pure operational promotion that preserves already-authorized behavior, `Technical Change` with the `operational` Change Characteristic is the expected classification. Classification and Workflow Depth MUST still be evaluated for the specific release risk.

The Release Work SHOULD reference:
- the release branch/ref;
- the candidate commit/ref;
- candidate artifact identity when applicable;
- the intended release scope or included Work references;
- beta validation evidence;
- the Human Release Approval result;
- production promotion/deployment evidence.

These references are operational context/evidence links. They MUST NOT duplicate or replace upstream product, architecture, implementation, or validation owners.

Release branches MUST remain short-lived.

Release-candidate corrections SHOULD be implemented through authorized Work/Task branches targeting the release branch rather than uncontrolled direct mutation.

Release corrections that must survive the release MUST be reconciled into `development` no later than release completion.

After promotion to `main`, `main` MUST be synchronized back into `development` before ordinary integration continues when necessary to restore the project's shared-ancestry invariant.

### 11.1 V1 Release Work route

The representative V1 route for a staged Release Work is:

```text
Idea
-> Preparing            release scope/candidate plan, Tasks when needed, Readiness
-> Ready
-> Implementing         create candidate, build artifact, deploy beta
-> Validating           collect/evaluate beta evidence
-> Awaiting Approval    Human Release Approval
-> Implementing         promote approved candidate to main/production and synchronize
-> Validating           production/promotion/synchronization evidence
-> Done
```

This is a project-specific route, not a new generic lifecycle.

If beta validation fails or the candidate changes materially, the Work returns to the activity/state authorized to correct the candidate, then repeats applicable validation and Human Release Approval.

The transition after Human Release Approval may return directly to `Implementing` because the promotion execution scope was prepared before initial Readiness. If the approval or discovered change introduces new scope, design, risk, or execution decisions, normal Method return/readiness rules apply instead.

## 12. Candidate identity and artifact promotion

The release process SHOULD preserve the identity of the candidate that received beta validation and Human Release Approval.

The preferred strategy is promotion of the same immutable artifact from beta to production.

If the Technical Design requires a rebuild between beta and production, it MUST define:
- the immutable source identity used for the rebuild;
- the reproducibility/equivalence guarantee;
- the validation evidence required to justify treating the rebuilt artifact as the approved candidate.

A rebuild MUST NOT silently substitute a materially different artifact for the approved candidate.

A material change to candidate source or artifact identity after approval invalidates the previous Human Release Approval.

## 13. Human Release Approval and Release Promotion Gate

V1 introduces **Human Release Approval** as a project-defined human-only Authority Gate for stable release promotion.

### 13.1 Human Release Authority

For V1, **Human Release Authority is held by a human Architecture Web maintainer explicitly
acting in the release-authority role for the identified candidate**.

Repository maintainer status is the project eligibility basis for holding this authority, but
GitHub write, merge, review, environment, or deployment capability does not by itself prove that
the human exercised Human Release Approval for a candidate.

The approval decision MUST be explicit and candidate-specific. Delegating the technical act of
merge or deployment does not delegate Human Release Authority unless a later accepted governance
rule explicitly defines such delegation.

Human Release Approval:
- applies to one identified release candidate;
- requires sufficient beta validation evidence;
- authorizes promotion of that candidate toward `main` and production;
- does not itself merge a PR or execute a deployment;
- MUST be renewed if the approved candidate changes materially.

AI MAY prepare evidence, assess readiness, recommend approval, and record an already-existing human decision when project policy permits.

AI MUST NOT execute Human Release Approval.

The approval record MUST:
- be attributable to a human Architecture Web maintainer explicitly acting as Human Release Authority;
- identify the Release Work;
- identify the approved candidate source/ref;
- identify the candidate artifact when artifact identity is part of the release guarantee.

A generic or stale approval that cannot be tied to the current candidate MUST NOT satisfy Human Release Approval.

The exact GitHub mechanism used to record or enforce this decision belongs to activation/Technical Design and does not change its semantic owner.

The Release Promotion Gate is distinct from the Work Merge Gate. It protects the normal `release/* -> main` promotion and may pass only when:
- the Release Work and candidate are identifiable;
- required beta evidence is sufficient;
- Human Release Approval exists for the current candidate;
- applicable repository checks/protections pass;
- no release blocker or unresolved out-of-authority Working Decision remains.

A GitHub PR review, environment approval, deployment status, or platform protection MAY record or enforce parts of this contract, but platform capability does not itself become semantic release authority.

The `release/* -> main` promotion PR MUST reference its Release Work and is governed by the Release Promotion Gate rather than the Work Merge Gate.

A passing Release Promotion Gate does not by itself grant automatic merge authority unless a separate accepted project policy explicitly grants that authority.

## 14. Runtime neutrality

Durable delivery governance MUST remain independent from a specific agent runtime or AI model.

The selected runtime implementation MAY change without redefining `agent:*`, Work State, Method Roles, Work Merge Gate semantics, or release authority.

Current runtime preference belongs to downstream Technical Design, not this durable governance owner.

## 15. Activation and effect

This proposal is not Current Truth until accepted and integrated into the appropriate canonical owner.

Even after governance acceptance, the following external mechanisms become effective operational owners/enforcement only after separate implementation and verification:
- `agent:*` label inventory and routing mapping;
- Task dependency mapping where newly extended;
- active Task execution-claim mapping/enforcement for mixed human/automated Work;
- Work Merge Gate status check/ruleset enforcement;
- Release Work operational mapping;
- `alpha`, `beta`, and `production` environment configuration;
- Release Promotion Gate enforcement;
- privileged publisher/project credentials;
- routing visibility/filtering in the Project views used for automated or human dispatch.

Until each mapping is verified, project tooling MUST treat that external owner/enforcement as unavailable rather than inventing a parallel substitute.

Downstream implementation Works remain subject to their own Task Planning, Readiness Review, review, and validation requirements.
