# Agent-aware GitHub delivery

> **Content status:** Proposed / Working artifact  
> **Authority:** Non-canonical. This exploration does not override project governance.  
> **Current Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Work State:** Designing  
> **Activity:** Governance Review

## Purpose

This exploration formalizes the target delivery model for human and AI execution in Architecture Web while preserving the Software Engineering Method's authority, lifecycle, review, validation, and ownership semantics.

The preceding Research / Discovery phase is considered sufficiently concluded for Governance Design. Its findings have been transferred into the proposed governance target in this directory.

## Current artifacts

- [Governance proposal](governance-proposal.md) — proposed target to review before any human governance approval.
- [Governance review](governance-review.md) — review findings against the Method and current Architecture Web delivery policy.
- [Working decisions](working-decisions.md) — temporary decision memory for the current Work.

## Current proposed direction

The current proposal establishes the following target concepts:

```text
Execution route/provider -> agent:* label
Human identity assignment -> GitHub native assignees
Method Role               -> Activity + Context Manifest

Work/Task execution
    -> deterministic coordinator
    -> explicit dependencies
    -> Work Integration Branch / PR
    -> Work Merge Gate in Validating

Branches
    development -> alpha
    release/*   -> beta
    main        -> production

Release
    -> Release Work
    -> beta evidence
    -> Human Release Approval
    -> Release Promotion Gate
    -> main / production

Agent runtime
    -> governance remains runtime-neutral
    -> current downstream technical preference: gh-aw + Codex
```

## Important authority boundary

Nothing in this directory is Current Truth merely because it exists on this branch.

If the governance target is accepted:

1. accepted durable rules must be integrated into `docs/project/delivery-pipeline.md` and any minimal dependent guidance that must reference them;
2. working/proposal artifacts must not remain as competing normative owners;
3. external GitHub mappings and enforcement must still be activated and verified separately;
4. downstream implementation Works must still pass their own planning, Readiness, review, and validation requirements.

## Current review status

The first governance review found changes required in the original proposal. The current `governance-proposal.md` is the corrected Review Draft V2.

The principal human authority decision still proposed for acceptance is:

> V1 uses Human Release Approval as a project-defined human-only Authority Gate for an identified beta-validated release candidate.

Until that governance decision is explicitly accepted, it remains a Proposed Target.
