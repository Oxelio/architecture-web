# Agent-aware GitHub delivery

> **Content status:** Approved Target / Working artifacts  
> **Authority:** Human-approved target for this Work; not yet Current Truth.  
> **Current Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Working Work State:** Ready  
> **Current Activity:** Implementation handoff after refreshed Readiness Review  
> **Operational note:** this working state is not claimed to be an activated GitHub Project `Work State` owner.

## Purpose

This directory preserves the working context for the agent-aware delivery governance Work until
its accepted durable conclusions are integrated into the canonical delivery owner.

Current repository delivery governance remains owned by:

```text
docs/project/delivery-pipeline.md
```

until the approved target is implemented there and merged through the authorized repository
process.

## Approved target

The amended proposal passed an independent Governance Review and received renewed Human
Governance Approval on 2026-08-23.

Exact approved target:

```text
governance-proposal.md
blob c28d487bd0f6d074406fe614fea03bdddd9c56a2
```

The prior approval for blob `97a92896ec722e6a305e12eb7185493ca2eee522` is historical only.

## Material amendments now approved

### Human Release Authority

V1 Human Release Authority is held by a human Architecture Web maintainer explicitly acting as
Human Release Authority for the identified candidate. GitHub capability does not itself establish
the semantic approval.

### V1 Task concurrency

V1 permits at most one active implementation Task execution per Work across human and automated
execution. An active Task execution claim is required before execution begins; exact claim/lease
mechanics remain downstream Technical Design / activation.

## Readiness result

The refreshed preparation record concludes:

```text
READY
```

The Work may therefore enter `Ready`. Canonical governance implementation is now authorized, but
has not yet been performed in this step.

## Current artifacts

- [Governance proposal](governance-proposal.md) — exact human-approved target.
- [Governance review](governance-review.md) — independent review evidence; result `PASS`.
- [Human Governance Approval](approval.md) — renewed attributable approval for the exact amended blob.
- [Preparing record](preparing.md) — refreshed Context Manifest, Task Plan, and Readiness Review (`READY`).
- [Working decisions](working-decisions.md) — temporary memory pending integration/downstream transfer.

## Runtime and external activation

The durable governance target remains runtime-neutral. `gh-aw + Codex` remains downstream
Technical Design scope, not durable governance.

External GitHub mappings/enforcement remain unavailable until separately implemented and verified,
including labels, Project mappings, Task execution-claim mechanics, merge/release gates,
environments, credentials, publisher boundaries, and runtime adapters.

## Cleanup rule

After canonical integration, Governance Compliance Review, and documentation validation:

1. resolve/integrate the Working Decision Log or move entries to explicit downstream Work;
2. remove this exploration from `docs/explorations/README.md`;
3. remove working proposal/review/readiness artifacts rather than retaining competing normative
   governance;
4. rely on Git history for the completed working-context history.
