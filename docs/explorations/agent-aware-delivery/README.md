# Agent-aware GitHub delivery

> **Content status:** Proposed / Working artifact  
> **Authority:** Non-canonical. This exploration does not override project governance.  
> **Current Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Working Work State:** Awaiting Approval  
> **Activity:** Human Governance Approval pending  
> **Operational note:** this working state is not claimed to be an activated GitHub Project `Work State` owner.

## Purpose

This exploration formalizes the proposed delivery model for human and AI execution in Architecture Web while preserving the Software Engineering Method's authority, lifecycle, review, validation, and ownership semantics.

The preceding Research / Discovery phase is concluded for this scope. Governance Design and two Governance Review passes have produced an approval candidate.

## Current artifacts

- [Governance proposal](governance-proposal.md) — corrected Proposed Target recommended for Human Governance Approval.
- [Governance review](governance-review.md) — second review; no unresolved review blocker remains.
- [Working decisions](working-decisions.md) — temporary decision memory pending governance acceptance/integration.

## Proposed direction

```text
Execution route/provider -> agent:* label
Human identity assignment -> GitHub native assignees
Method Role               -> Activity + Context Manifest

Ready Queue
    -> lifecycle/dependency/WIP eligibility
    -> executor-compatible agent:* filter
    -> existing Priority/tie-break policy

Work/Task execution
    -> deterministic coordinator
    -> explicit dependencies
    -> serialized coordinator-managed Task dispatch in V1
    -> Work Integration Branch / PR
    -> Work Merge Gate in Validating

Branches / environments
    development -> alpha
    release/*   -> beta
    main        -> production

Release Work
    -> candidate + beta evidence
    -> Human Release Approval
    -> Release Promotion Gate
    -> main / production
    -> synchronize main back into development

Agent runtime
    -> durable governance remains runtime-neutral
    -> downstream technical preference remains gh-aw + Codex
```

## Authority boundary

Nothing in this directory is Current Truth merely because it exists on this branch.

The current Governance Review recommends the Work transition:

```text
Designing
-> Awaiting Approval
```

This transition records that a human governance decision is pending. It does not execute that decision.

Material Governance Changes require explicit Human Governance Approval under the Project Method Profile.

## Pending human decision

The approval candidate proposes the entire agent-aware delivery governance scope, including:

> V1 defines Human Release Approval as a project-specific human-only Authority Gate for an identified beta-validated release candidate.

If Human Governance Approval accepts the proposal, the accepted target must then be integrated into the canonical delivery owner before it becomes effective repository-owned policy.

## After approval

Acceptance and effect remain distinct:

1. integrate accepted durable rules into `docs/project/delivery-pipeline.md`;
2. make only minimal dependent updates to `AGENTS.md` / coding-agent guidance where needed;
3. resolve/integrate the Working Decision Log rather than keeping it as a competing owner;
4. separately implement and verify external GitHub mappings/enforcement;
5. perform downstream Technical Design, Task Planning, and Readiness Review for implementation Works;
6. remove this exploration from the active index once its durable conclusions have been integrated and Git history is sufficient.
