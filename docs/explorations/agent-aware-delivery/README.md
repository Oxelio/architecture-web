# Agent-aware GitHub delivery

> **Content status:** Approved Target / Working artifacts  
> **Authority:** The durable target is human-approved but not yet Current Truth.  
> **Current Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Working Work State:** Ready  
> **Current Activity:** Implementation handoff after Readiness Review  
> **Operational note:** this working state is not claimed to be an activated GitHub Project `Work State` owner.

## Purpose

This directory preserves the working context for the approved agent-aware
delivery governance target until its durable conclusions are implemented into
the canonical delivery owner.

The preceding Research / Discovery, Governance Design, two Governance Review
passes, and Human Governance Approval are complete for this scope.

## Current artifacts

- [Governance proposal](governance-proposal.md) — exact reviewed target that was
  approved. Its original pre-approval status metadata is retained as part of the
  reviewed snapshot; the approval record below establishes the later authority
  result.
- [Governance review](governance-review.md) — second review; no unresolved
  governance-design blocker remained.
- [Human Governance Approval](approval.md) — attributable approval record for
  the reviewed target.
- [Preparing record](preparing.md) — Context Manifest, Task Plan, and Readiness
  Review.
- [Working decisions](working-decisions.md) — temporary decision memory to be
  resolved as accepted conclusions are integrated into durable owners.

## Authority result

Human Governance Approval accepted the reviewed target on 2026-08-23.

That result creates an **Approved Target**. It does not make the proposal
Current Truth by itself.

The canonical project owner remains:

```text
docs/project/delivery-pipeline.md
```

until the approved rules are implemented there and merged through the
repository's authorized process.

External GitHub mappings/enforcement remain separately inactive until verified.

## Readiness result

The preparation record concludes:

```text
READY
```

for canonical governance integration.

The next lifecycle transition is:

```text
Ready
-> Implementing
```

The implementation scope is bounded to synchronizing the approved target into
the canonical delivery owner and only the minimal dependent agent guidance
needed to avoid contradictions.

Runtime implementation, GitHub operational-owner activation, Merge Gate
enforcement, release environments, privileged publisher credentials, and the
first concrete agent adapter remain separately scoped downstream Works.

## Cleanup rule

After canonical integration and validation:

1. resolve the Working Decision Log into its durable owners or downstream scope;
2. remove this exploration from `docs/explorations/README.md`;
3. do not retain these working artifacts as competing normative governance;
4. rely on Git history for the completed design/review/approval record when
   repository history is sufficient.
