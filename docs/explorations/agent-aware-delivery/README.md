# Agent-aware GitHub delivery

> **Content status:** Approved Target / Working artifacts  
> **Authority:** Human-approved target for this Work; canonical implementation exists on the working branch but is not yet effective on `development`.  
> **Current Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Working Work State:** Validating  
> **Current Activity:** Integration PR preparation after successful review and validation  
> **Operational note:** this working state is not claimed to be an activated GitHub Project `Work State` owner.

## Purpose

This directory preserves the working context for the agent-aware delivery governance Work until its accepted durable conclusions are integrated into the canonical delivery owner and accepted through the authorized repository process.

The durable owner is:

```text
docs/project/delivery-pipeline.md
```

The approved target has been implemented into that owner on branch `governance/agent-aware-delivery`. The change is not yet effective Current Truth on `development`.

## Approved target

The amended proposal passed an independent Governance Review and received renewed Human Governance Approval on 2026-08-23.

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

The implementation includes the approved execution-routing, Task-concurrency, Work Integration Branch, Work Merge Gate, privileged-publication, deterministic control-plane, staged-release, Human Release Approval, Release Promotion Gate, runtime-neutrality, and activation rules.

`AGENTS.md` and `docs/ai/coding-agent-guidelines.md` were reviewed and require no dependent change: they already reference the canonical delivery profile and do not establish contradictory routing, branch, merge, concurrency, or release-authority policy.

## Review result

[Governance Compliance Review](implementation-review.md) concluded:

```text
PASS
```

The canonical patch preserves the approved governance semantics without adding runtime-specific choices or unrelated product/architecture policy.

## Validation result

[Documentation Validation](validation.md) concludes:

```text
PASS
```

Established evidence:

- relative Markdown link impact review: PASS;
- `git diff --check`: PASS;
- repository `pnpm format:check`: PASS;
- Governance Compliance Review: PASS.

No documentation-validation blocker remains.

## Working Decision resolution

[Working decisions](working-decisions.md) is closed for this governance scope:

- governance decisions are `Resolved — Integrated` into `docs/project/delivery-pipeline.md`;
- WD-010 is superseded by the broader V1 Task-concurrency rule;
- WD-023 (`gh-aw + Codex`) is moved to explicit downstream Technical Design scope;
- no unresolved Working Decision remains for this governance implementation.

## Runtime and external activation

The durable governance remains runtime-neutral. `gh-aw + Codex` remains downstream Technical Design scope, not durable governance.

External GitHub mappings/enforcement remain unavailable until separately implemented and verified, including labels, Project mappings, Task execution-claim mechanics, merge/release gates, environments, credentials, publisher boundaries, and runtime adapters.

## Current handoff

The implementation is reviewed and validated. The next repository action is an integration Pull Request from:

```text
governance/agent-aware-delivery
-> development
```

Opening or merging that PR does not itself activate the downstream GitHub mechanisms described by the policy. Merge authority remains separate.

## Cleanup rule

After the canonical integration is accepted through the repository process:

1. remove this exploration from `docs/explorations/README.md`;
2. remove working proposal/review/readiness/validation artifacts rather than retaining competing normative governance;
3. rely on Git history for the completed working-context history.
