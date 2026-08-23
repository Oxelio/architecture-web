# Architecture Web — Agent-Aware Delivery Governance Review

> **Content status:** Working review  
> **Authority:** Non-canonical. This review does not approve governance.  
> **Reviewed target:** `governance-proposal.md`  
> **Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Work State:** Designing -> Awaiting Approval recommended  
> **Activity:** Governance Review  
> **Review result:** RECOMMEND HUMAN GOVERNANCE APPROVAL

## 1. Review basis

This second governance review checks the corrected proposal against:

- the adopted Software Engineering Method lifecycle, ownership, Role, Working Decision, Review, Validation, and Readiness semantics;
- the current Architecture Web Project Method Profile;
- the current canonical `docs/project/delivery-pipeline.md`;
- root `AGENTS.md`;
- `docs/ai/coding-agent-guidelines.md`;
- the findings recorded by the first governance review.

The proposal remains a Proposed Target until explicit Human Governance Approval and later integration into the canonical owner.

## 2. First-review closure

The corrected proposal closes GR-01 through GR-18 from the first review.

In particular, it now:

- separates `agent:*` execution routing from GitHub human assignees;
- keeps routing/automation eligibility separate from lifecycle/Readiness eligibility;
- defines routing mutation authority and forbids agent self-routing;
- keeps Method Role resolution independent from the physical execution agent;
- supports one primary Work Integration Branch while allowing Task branches;
- defines the Work Merge Gate as composite enforcement over already-established semantic results;
- evaluates the V1 Work Merge Gate in `Validating`;
- requires acceptable Task terminal disposition rather than treating arbitrary closure as success;
- makes privileged credential separation mandatory;
- requires deterministic target-ref validation;
- explicitly introduces short-lived `release/*` promotion instead of silently retaining the old direct `development -> main` normal path;
- restores the `development`-descends-from-`main` invariant after stable promotion;
- introduces a Release Work as release-candidate coordination owner;
- proposes Human Release Approval as a human-only release authority gate;
- preserves candidate/artifact identity;
- keeps durable governance runtime-neutral;
- preserves external-owner activation/effect rules;
- uses the project's established `MUST` / `SHOULD` / `MAY` normative vocabulary.

No first-review blocker remains unresolved in the reviewed candidate.

## 3. Second-review findings and resolution

| ID | Severity | Finding | Resolution in reviewed candidate | Status |
| --- | --- | --- | --- | --- |
| GR2-01 | BLOCKER | Human Release Approval was defined without a Release Work lifecycle route, leaving the coordinator to invent how beta validation, approval, promotion, and final validation relate. | Added an explicit V1 Release Work route: `Preparing -> Ready -> Implementing -> Validating -> Awaiting Approval -> Implementing -> Validating -> Done`, with normal upstream returns when candidate or scope changes. | RESOLVED |
| GR2-02 | BLOCKER | Work Merge Gate and Release Promotion Gate could otherwise overlap on `release/* -> main`, creating incompatible state/gate requirements. | Work Merge Gate now governs Work Integration PRs, including release-fix Work into `release/*`; the Release Work promotion PR `release/* -> main` is governed by the distinct Release Promotion Gate. | RESOLVED |
| GR2-03 | MAJOR | The existing Continuous Flow Ready Queue policy needed an explicit relationship with executor-specific `agent:*` routing to avoid routing becoming a competing Priority/lifecycle owner. | Added two-stage dispatch: lifecycle/dependency/WIP eligibility first, then executor-route filtering, then existing Priority/tie-break policy inside the executor-compatible candidate set. | RESOLVED |
| GR2-04 | MAJOR | V1 did not explicitly constrain coordinator-managed Task concurrency inside one Work, despite concurrency being a material risk for shared Work branches. | V1 now serializes coordinator-managed Task execution per Work unless a human explicitly authorizes a bounded delivery exception. | RESOLVED |
| GR2-05 | MAJOR | Human Release Approval needed a candidate-specific attributable record contract rather than a generic platform approval. | Approval record must identify the human authority, Release Work, candidate source/ref, and candidate artifact when applicable. Stale/generic approval is insufficient. | RESOLVED |

## 4. Method consistency assessment

### Authority

The proposal does not grant AI any human-only authority.

It explicitly preserves:
- Human Functional Approval;
- Human Governance Approval;
- the proposed Human Release Approval;
- separate repository merge authority.

The Workflow Coordinator records or enforces established results but does not manufacture the semantic decision that created them.

### Lifecycle

The proposal does not add new generic Work States.

The Work Merge Gate is evaluated within `Validating`.

The Release Work uses a project-specific route built from existing Method states and normal return semantics.

The proposed transition to `Awaiting Approval` for the current Governance Change is valid because design/review is complete enough for an external human governance decision and AI is not executing that decision.

### Ownership

The proposal preserves single-owner semantics:

```text
Delivery governance                  -> docs/project/delivery-pipeline.md
Execution route/provider             -> agent:* once activated
Human identity assignment            -> GitHub native assignees
Method Role                          -> Method Activity/Context resolution
Release candidate coordination       -> Release Work once activated
Review acceptance                    -> responsible Review Role/result
Validation sufficiency               -> responsible validation/evidence result
Human Release Approval               -> human release authority
Implementation                       -> code
Validation evidence                  -> tests / CI / reports / other evidence
```

The Release Work references release scope and evidence; it does not duplicate product, architecture, or validation truth.

### Review and validation

The Work Merge Gate and Release Promotion Gate are enforcement/composition mechanisms only.

They do not replace:
- Code Review;
- Architecture Review;
- Functional Compliance Review;
- specialist review;
- Evidence Gate evaluation.

This preserves the Method distinction between review acceptance and validation evidence.

### Readiness

`agent:*` is not a Readiness prerequisite.

A Work may be validly `Ready` while unassigned or routed to `agent:human`.

Runtime availability affects dispatchability, not the semantic validity of the Work's Ready state.

## 5. Canonical integration impact if approved

If Human Governance Approval accepts the proposal, the accepted durable rules should be integrated primarily into:

- `docs/project/delivery-pipeline.md`

Minimal dependent changes may then be required in:

- `AGENTS.md` — only where an operational agent instruction must point to the new canonical delivery rules;
- `docs/ai/coding-agent-guidelines.md` — only where execution routing / Work Integration Branch behavior materially changes coding-agent instructions;
- `docs/explorations/README.md` — remove the active exploration entry once durable conclusions are integrated and working memory is no longer needed.

The canonical patch must not preserve this proposal/review as a competing governance owner after integration.

## 6. External activation remains separate

Governance acceptance will not by itself activate:

- `agent:*` labels as operational routing owners;
- Task dependency mappings not already activated;
- Project routing visibility/filtering;
- Work Merge Gate required checks/rulesets;
- Release Work operational mapping;
- `alpha`, `beta`, and `production` environments;
- Release Promotion Gate enforcement;
- privileged publisher / Project credentials;
- any selected agent runtime.

Those mechanisms require downstream implementation and verification before becoming effective Current Truth.

## 7. Review verdict

**No unresolved Governance Review blocker remains in the corrected proposal.**

The reviewer recommends transition of the Governance Change from:

```text
Designing
-> Awaiting Approval
```

The pending authority decision is **Human Governance Approval** of the proposed governance scope.

That approval would, among the other proposed rules, accept **Human Release Approval** as a project-defined human-only Authority Gate for a candidate-specific stable release.

This review recommends approval but does not execute it.
