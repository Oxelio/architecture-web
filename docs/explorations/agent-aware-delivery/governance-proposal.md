# Architecture Web — Agent-Aware GitHub Delivery Governance Proposal — Review Draft V2

> **Content status:** Proposed Target  
> **Document type:** Governance proposal / working artifact  
> **Authority:** Not approved. Not Current Truth.  
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

Human Release Approval:
- applies to one identified release candidate;
- requires sufficient beta validation evidence;
- authorizes promotion of that candidate toward `main` and production;
- does not itself merge a PR or execute a deployment;
- MUST be renewed if the approved candidate changes materially.

AI MAY prepare evidence, assess readiness, recommend approval, and record an already-existing human decision when project policy permits.

AI MUST NOT execute Human Release Approval.

The Release Promotion Gate protects the normal `release/* -> main` promotion and may pass only when:
- the Release Work and candidate are identifiable;
- required beta evidence is sufficient;
- Human Release Approval exists for the current candidate;
- applicable repository checks/protections pass;
- no release blocker or unresolved out-of-authority Working Decision remains.

A GitHub PR review, environment approval, deployment status, or platform protection MAY record or enforce parts of this contract, but platform capability does not itself become semantic release authority.

## 14. Runtime neutrality

Durable delivery governance MUST remain independent from a specific agent runtime or AI model.

The selected runtime implementation MAY change without redefining `agent:*`, Work State, Method Roles, Work Merge Gate semantics, or release authority.

Current runtime preference belongs to downstream Technical Design, not this durable governance owner.

## 15. Activation and effect

This proposal is not Current Truth until accepted and integrated into the appropriate canonical owner.

Even after governance acceptance, the following external mechanisms become effective operational owners/enforcement only after separate implementation and verification:
- `agent:*` label inventory and routing mapping;
- Task dependency mapping where newly extended;
- Work Merge Gate status check/ruleset enforcement;
- Release Work operational mapping;
- `alpha`, `beta`, and `production` environment configuration;
- Release Promotion Gate enforcement;
- privileged publisher/project credentials.

Until each mapping is verified, project tooling MUST treat that external owner/enforcement as unavailable rather than inventing a parallel substitute.

Downstream implementation Works remain subject to their own Task Planning, Readiness Review, review, and validation requirements.
