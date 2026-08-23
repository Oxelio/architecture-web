# Agent-aware GitHub delivery

> **Content status:** Proposed / Working artifacts  
> **Authority:** Non-canonical. The current amended target is not approved and is not Current Truth.  
> **Current Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Working Work State:** Designing  
> **Current Activity:** Governance Design after independent review  
> **Operational note:** this working state is not claimed to be an activated GitHub Project `Work State` owner.

## Purpose

This directory preserves the working context for the agent-aware delivery governance Work until accepted durable conclusions are integrated into the canonical delivery owner.

The repository remains authoritative. The canonical current delivery policy is still:

```text
docs/project/delivery-pipeline.md
```

on `development`.

## Current review outcome

An independent review of the previously approved target returned:

```text
Governance Review: CHANGES REQUIRED
Readiness Review:  NOT READY
```

Two governance blockers were accepted:

1. the semantic holder of **Human Release Authority** was not defined;
2. V1 did not define concurrency between a human-executed Task and an automated Task in the same Work.

The previous `READY` result in `preparing.md` is therefore superseded.

## Current amended target

[governance-proposal.md](governance-proposal.md) has been amended to propose:

### Human Release Authority

For V1, Human Release Authority is held by a **human Architecture Web maintainer explicitly acting in the release-authority role for the identified candidate**.

Maintainer status defines eligibility to hold the authority; GitHub merge/review/environment/deployment capability does not itself constitute candidate-specific approval.

### V1 Task concurrency

V1 permits **at most one active implementation Task execution per Work**, regardless of whether the Task is routed to a human or an automated agent.

Execution requires an active Task execution claim. The concrete claim/lease representation belongs to downstream activation/Technical Design.

Until that mechanism is activated and verified, automated dispatch may not assume that a mixed human/automated Work is idle when human Task activity cannot be reliably observed.

## Authority status

The previous Human Governance Approval in [approval.md](approval.md) remains a valid historical approval record for proposal blob:

```text
97a92896ec722e6a305e12eb7185493ca2eee522
```

It **does not approve the amended proposal**.

The amended target requires:

```text
Designing
-> Governance Review
-> Awaiting Approval
-> renewed Human Governance Approval
-> Preparing
-> Readiness Review
```

before canonical implementation can begin.

## Current artifacts

- [Governance proposal](governance-proposal.md) — amended Proposed Target; not yet approved.
- [Governance review](governance-review.md) — current review disposition and accepted findings.
- [Human Governance Approval](approval.md) — approval record for the prior proposal blob only.
- [Preparing record](preparing.md) — previous readiness result superseded; current result NOT READY.
- [Working decisions](working-decisions.md) — temporary decision memory including WD-034 and WD-035.

## Runtime and external activation

The durable governance target remains runtime-neutral. `gh-aw + Codex` remains a downstream Technical Design preference, not a governance rule.

External GitHub mappings and enforcement remain unavailable until separately implemented and verified, including labels, Project mappings, execution-claim mechanics, merge/release gates, environments, credentials, and runtime adapters.

## Cleanup rule

After an amended target is approved, integrated into the canonical owner, reviewed, and validated:

1. resolve the Working Decision Log into durable owners or downstream Works;
2. remove this exploration from `docs/explorations/README.md`;
3. do not retain proposal/review files as competing normative governance;
4. rely on Git history for completed working-context history.
