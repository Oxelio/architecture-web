# Agent-aware GitHub delivery

> **Content status:** Approved Target / Working artifacts  
> **Authority:** Human-approved target for this Work; canonical implementation exists on the working branch but is not yet effective on `development`.  
> **Current Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Working Work State:** Validating  
> **Current Activity:** Documentation Validation after Governance Compliance Review  
> **Operational note:** this working state is not claimed to be an activated GitHub Project `Work State` owner.

## Purpose

This directory preserves the working context for the agent-aware delivery governance Work until
its accepted durable conclusions are integrated into the canonical delivery owner, reviewed,
validated, and completed through the authorized repository process.

The durable owner is:

```text
docs/project/delivery-pipeline.md
```

The approved target has now been implemented into that owner on branch
`governance/agent-aware-delivery`. The change is not yet effective Current Truth on `development`.

## Approved target

The amended proposal passed an independent Governance Review and received renewed Human
Governance Approval on 2026-08-23.

Exact approved target:

```text
governance-proposal.md
blob c28d487bd0f6d074406fe614fea03bdddd9c56a2
```

The prior approval for blob `97a92896ec722e6a305e12eb7185493ca2eee522` is historical only.

## Canonical implementation

The approved target was integrated into:

```text
docs/project/delivery-pipeline.md
blob a38ec79465307cad8c9030571e9b68678ff8c61e
```

The implementation includes the approved execution-routing, Task-concurrency, Work Integration
Branch, Work Merge Gate, privileged-publication, deterministic control-plane, staged-release,
Human Release Approval, Release Promotion Gate, runtime-neutrality, and activation rules.

`AGENTS.md` and `docs/ai/coding-agent-guidelines.md` were reviewed and require no dependent change:
they already reference the canonical delivery profile and do not establish contradictory routing,
branch, merge, concurrency, or release-authority policy.

## Review result

[Governance Compliance Review](implementation-review.md) concluded:

```text
PASS
```

The canonical patch preserves the approved governance semantics without adding runtime-specific
choices or unrelated product/architecture policy.

## Validation status

[Documentation Validation](validation.md) currently concludes:

```text
VALIDATION INCOMPLETE
```

Established evidence:

- relative Markdown link target set unchanged: PASS;
- `git diff --check`: PASS;
- Governance Compliance Review: PASS.

Outstanding evidence:

- repository formatter / `pnpm format:check` has not been executed in an actual branch checkout;
- no CI/status check was attached to the canonical integration commit when inspected.

The Work therefore remains in `Validating` and is not `Done`.

## Current artifacts

- [Governance proposal](governance-proposal.md) — exact human-approved target.
- [Governance review](governance-review.md) — independent target review evidence; result `PASS`.
- [Human Governance Approval](approval.md) — renewed attributable approval for the exact amended blob.
- [Preparing record](preparing.md) — refreshed Context Manifest, Task Plan, and Readiness Review (`READY`).
- [Governance Compliance Review](implementation-review.md) — canonical implementation review (`PASS`).
- [Documentation Validation](validation.md) — current validation evidence (`VALIDATION INCOMPLETE`).
- [Working decisions](working-decisions.md) — temporary memory pending final resolution/downstream transfer.

## Runtime and external activation

The durable governance remains runtime-neutral. `gh-aw + Codex` remains downstream Technical
Design scope, not durable governance.

External GitHub mappings/enforcement remain unavailable until separately implemented and verified,
including labels, Project mappings, Task execution-claim mechanics, merge/release gates,
environments, credentials, publisher boundaries, and runtime adapters.

## Cleanup rule

After validation is sufficient and canonical integration is accepted through the repository process:

1. resolve/integrate the Working Decision Log or move entries to explicit downstream Work;
2. remove this exploration from `docs/explorations/README.md`;
3. remove working proposal/review/readiness/validation artifacts rather than retaining competing
   normative governance;
4. rely on Git history for the completed working-context history.
