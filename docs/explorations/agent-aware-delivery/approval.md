# Agent-aware GitHub delivery — Human Governance Approval

> **Content status:** Approval record  
> **Authority:** Human Governance Approval record for this Work  
> **Decision:** APPROVED  
> **Date:** 2026-08-23  
> **Human authority:** connected Architecture Web repository maintainer `Oxelio`  
> **Approved target:** `governance-proposal.md` at blob `97a92896ec722e6a305e12eb7185493ca2eee522`

## Decision

The reviewed **Agent-Aware GitHub Delivery Governance Proposal** is approved as
the target governance for this Work.

The approval includes the complete reviewed scope, including:

- `agent:*` execution-route/provider ownership;
- separation of human identity assignment, execution routing, Method Role, and
  runtime/model selection;
- deterministic Work/Task dispatch and V1 serialized coordinator-managed Task
  execution;
- Work Integration Branch / PR policy;
- Work Merge Gate semantics in `Validating`;
- privileged publisher / credential separation;
- explicit target-ref control-plane semantics;
- `development -> alpha`, `release/* -> beta`, `main -> production`;
- short-lived Release Work / release-candidate coordination;
- candidate identity and immutable-artifact promotion guarantees;
- **Human Release Approval** as a project-defined human-only Authority Gate;
- a distinct Release Promotion Gate for `release/* -> main`;
- synchronization of `main` back into `development` after stable promotion when
  required to restore shared ancestry;
- runtime-neutral durable governance.

## Authority and effect

This decision converts the reviewed proposal from a **Proposed Target** into an
**Approved Target** for the identified Work.

It does **not** by itself make the target Current Truth.

The target becomes repository-owned Current Truth only after the accepted rules
are implemented into their proper canonical owner and merged through the
repository's authorized process.

External GitHub labels, Project fields, relations, status checks, environments,
credentials, or runtime adapters become effective operational owners or
enforcement only after their separate activation/implementation requirements
are verified.

## Lifecycle consequence

The human-only governance gate is satisfied for this target.

The Work may leave:

```text
Awaiting Approval
```

and enter:

```text
Preparing
```

for Task Planning, Readiness Review, canonical integration planning, and
downstream activation planning.
