# Agent-aware GitHub delivery — Governance Compliance Review

> **Content status:** Working review  
> **Authority:** Non-canonical review evidence  
> **Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Reviewed approved target:** `governance-proposal.md` blob `c28d487bd0f6d074406fe614fea03bdddd9c56a2`  
> **Reviewed canonical implementation:** `docs/project/delivery-pipeline.md` blob `a38ec79465307cad8c9030571e9b68678ff8c61e`  
> **Activity:** Governance Compliance Review  
> **Review result:** PASS

## 1. Purpose

This review checks whether the canonical delivery-policy patch preserves the exact approved governance semantics without inventing additional governance, product behavior, architecture, or runtime choices.

It is separate from documentation Validation. Review asks whether the policy implementation is acceptable against the Approved Target; Validation provides formatting/link/diff evidence.

## 2. Compliance result

No governance-compliance blocker was found.

The canonical patch preserves the approved target for:

- `agent:*` as execution-route/provider ownership, separate from human identity, Method Role, runtime/model, and authority;
- routing cardinality, no hidden Readiness gate, no automated self-routing, and deterministic executor filtering after lifecycle/dependency/WIP eligibility;
- Work/Task executable-unit semantics and V1 single active implementation Task execution per Work across human and automated execution;
- active Task execution claim semantics while leaving its concrete lock/lease/field/recovery mechanism downstream;
- Work Integration Branch / Pull Request policy and Work Merge Gate evaluation in `Validating`;
- separation of Work Merge Gate, review acceptance, validation sufficiency, merge authority, and `Done`;
- privileged publisher / least-privilege boundary and deterministic target-ref control plane;
- normal staged release topology `development -> alpha`, `release/* -> beta`, `main -> production`;
- Release Work as a normal Method Work and operational coordination owner rather than a new Work Type or truth owner;
- candidate identity, preferred immutable-artifact promotion, and rebuild/equivalence constraints;
- Human Release Authority held by a human Architecture Web maintainer explicitly acting for an identified candidate;
- candidate-specific Human Release Approval as a human-only Authority Gate;
- Release Promotion Gate as distinct from Work Merge Gate and merge authority;
- synchronization of `main` back into `development` when required to restore shared ancestry;
- runtime-neutral durable governance and separate activation/verification of external GitHub mechanisms.

## 3. Replacement / contradiction audit

The prior ordinary direct `development -> main` promotion rule was not retained as a competing normal path. The canonical branch policy now defines short-lived `release/*` as the normal beta/stable candidate route and requires any emergency/direct path to be explicit and unable to bypass the Release Promotion Gate.

No runtime-specific preference such as `gh-aw` or `openai/codex-action` was promoted into the canonical governance owner.

No product behavior or architecture owner was modified by this patch.

## 4. Dependent guidance audit

`AGENTS.md` already resolves operational delivery semantics through `docs/project/delivery-pipeline.md`, distinguishes tool capability from authority, forbids automatic crossing of human-only gates, and treats merged PR as distinct from `Done`.

`docs/ai/coding-agent-guidelines.md` already routes coding agents through the canonical delivery profile and requires escalation of governance decisions rather than hiding them in implementation.

Neither file contains a contradictory branch, routing, Task-concurrency, merge-gate, or release-authority rule. No dependent edit is required for this Work.

## 5. Review findings

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| GCR-01 | NOTE | The canonical patch materially changes only the project delivery-governance owner. | Expected and authorized. |
| GCR-02 | NOTE | External labels, claims, checks, environments, credentials, gates, and runtime adapters remain unactivated after this documentation patch. | Correct; downstream activation Works own implementation/verification. |
| GCR-03 | NOTE | Runtime-specific preference remains outside durable governance. | Correct; retain for downstream Technical Design only. |

## 6. Review verdict

```text
Governance Compliance Review: PASS
```

The Work may leave implementation/compliance review and proceed to documentation Validation. This review does not imply that external GitHub enforcement is active and does not by itself establish `Done`.
