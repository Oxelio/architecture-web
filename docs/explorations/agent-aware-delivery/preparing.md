# Agent-aware GitHub delivery — Preparing record

> **Content status:** Working artifact  
> **Authority:** Non-canonical preparation record  
> **Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Work State:** Preparing  
> **Activity:** Task Planning + Readiness Review  
> **Human Governance Approval:** accepted on 2026-08-23 by the connected repository maintainer `Oxelio`  
> **Approved Target:** `governance-proposal.md`

## 1. Approval result

Human Governance Approval has accepted the complete reviewed target in
`governance-proposal.md`, including **Human Release Approval** as a
project-defined human-only Authority Gate for one identified beta-validated
release candidate.

This approval creates an **Approved Target** for this Work. It does not make the
proposal Current Truth by itself.

Current Truth remains the canonical project governance on `development` until
the accepted target is implemented into the proper durable owner and merged
through the repository's authorized process.

External GitHub mappings and enforcement remain separately inactive until their
activation requirements are implemented and verified.

## 2. Context Manifest

### Identity

```text
Project: Architecture Web
Work: Establish agent-aware GitHub delivery governance
Work Type: Governance Change
Workflow Depth: Complex
Work State: Preparing
Activity: Task Planning + Readiness Review
Role: Technical Planner / Workflow Coordinator
```

### Context status

`RESOLVED`

### Authoritative context

- `docs/project/project-method-profile.md`
  - owns project Method bindings and human governance-authority policy.
- `docs/project/delivery-pipeline.md`
  - owns current Architecture Web delivery governance.
- `external/software-engineering-method/`
  - owns generic lifecycle, Work classification, Roles, Working Decisions,
    Readiness, review/validation, and ownership semantics.
- `AGENTS.md`
  - owns repository operational instructions for agents.
- `docs/ai/coding-agent-guidelines.md`
  - owns coding-agent execution guidance.
- `docs/development/testing.md`
  - owns project validation commands and proportional documentation checks.

### Required working context

- `governance-proposal.md`
  - Human-approved target to implement.
- `governance-review.md`
  - review evidence showing no unresolved governance-design blocker.
- `working-decisions.md`
  - temporary decision memory to resolve as durable owners are synchronized.
- this preparation record
  - Task Planning and Readiness evidence.

### Relevant evidence

- branch `governance/agent-aware-delivery` descends from `development`;
- the proposal has passed two governance-review passes;
- explicit Human Governance Approval exists for the reviewed target;
- current external GitHub mappings/enforcement are intentionally not assumed
  active merely because the governance target is approved.

### Missing / conflicting context

No missing or conflicting context blocks implementation of the **canonical
governance documentation change**.

The following are intentionally downstream concerns and do not block this Work:
- creation/verification of `agent:*` labels;
- Project v2 operational-owner activation;
- Work Merge Gate implementation;
- Release Promotion Gate implementation;
- environment configuration;
- privileged publisher credentials;
- selected agent runtime (`gh-aw`, direct Codex action, or another adapter).

Those mechanisms must be implemented and verified by separately scoped
downstream Works before they are treated as effective operational Current Truth.

## 3. Task Plan

### T1 — Integrate accepted delivery rules into the canonical owner

**Owner / Role**
- Developer acting within the approved Governance Change scope.

**Target**
- `docs/project/delivery-pipeline.md`

**Source**
- `governance-proposal.md`
- `governance-review.md`

**Required outcome**
- integrate the accepted `agent:*` routing semantics;
- preserve GitHub assignees as the human identity assignment owner;
- integrate deterministic control-plane and Ready Queue routing semantics;
- integrate V1 serialized coordinator-managed Task dispatch;
- integrate Work Integration Branch / Work Merge Gate policy;
- integrate scheduled-control-plane / explicit target-ref policy;
- replace the normal direct `development -> main` stable-promotion assumption
  with the accepted short-lived `release/*` staged release path;
- integrate Release Work, candidate identity, artifact promotion, Human Release
  Approval, Release Promotion Gate, and ancestry-restoration policy;
- preserve runtime neutrality;
- preserve external-owner activation semantics.

**Constraint**
- do not copy the proposal as a competing second policy document;
- reconcile the accepted target with existing wording inside the same canonical
  owner so no contradictory branch, merge, or authority rule remains.

**Validation**
- review the resulting owner for contradictory normative statements;
- validate relative Markdown links;
- run project documentation formatting checks;
- inspect `git diff --check`.

### T2 — Synchronize only dependent agent guidance that materially changes

**Owner / Role**
- Developer within the approved Governance Change scope.

**Targets**
- `AGENTS.md` only if repository-wide operational instructions need a direct
  pointer or constraint;
- `docs/ai/coding-agent-guidelines.md` only where execution routing, Work
  Integration Branch behavior, protected-file handling, or escalation semantics
  would otherwise conflict with the new canonical delivery policy.

**Constraint**
- reference `docs/project/delivery-pipeline.md`;
- do not duplicate its normative policy.

**Validation**
- no competing lifecycle, routing, merge, or authority rules are introduced.

### T3 — Resolve working decision memory

**Owner / Role**
- Workflow Coordinator after T1/T2.

**Target**
- `working-decisions.md`

**Required outcome**
- mark governance decisions integrated once their canonical owner contains them;
- move runtime-specific `gh-aw + Codex` preference to downstream Technical
  Design scope rather than durable governance;
- leave no unresolved Working Decision for the completed governance scope.

### T4 — Close the exploration/handoff artifacts

**Owner / Role**
- Workflow Coordinator after canonical integration.

**Targets**
- `README.md` in this directory;
- `docs/explorations/README.md`;
- proposal/review/working-memory files as appropriate.

**Required outcome**
- remove the exploration from the active index after durable conclusions are
  integrated;
- do not keep proposal/review artifacts as parallel normative history;
- Git remains the historical record.

### T5 — Validate the documentation-only governance implementation

**Owner / Role**
- QA / Test Architect or responsible validation activity.

**Evidence**
- all relative Markdown links resolve against the canonical tree;
- formatting check passes (`pnpm format:check` or equivalent project formatter);
- `git diff --check` passes;
- manual governance consistency review confirms the accepted target was
  integrated without changing unrelated product/architecture truth.

### T6 — Create downstream implementation Works after governance integration

These are separate Works, not hidden Tasks of this documentation change:

1. activate and verify GitHub operational owners/mappings;
2. establish independent baseline CI if still missing;
3. Technical Design for the deterministic coordinator and privileged publisher;
4. Technical Design / implementation of the first agent runtime adapter;
5. implement and verify Work Merge Gate enforcement;
6. implement and verify `alpha` / `beta` / `production` release deployment;
7. implement and verify Human Release Approval recording and Release Promotion
   Gate enforcement.

Each downstream Work receives its own classification, Context Manifest, Task
Planning, and Readiness Review.

## 4. Readiness Review

### Prerequisite gates

- Human Governance Approval: **PASS**
- Functional approval: **not applicable**
- durable structural ADR approval: **not triggered**
- governance review: **PASS**

### Authority readiness

**PASS**

The governance target has explicit human acceptance. The implementation task is
to synchronize the accepted target into the existing canonical delivery owner,
not to invent new policy.

### Functional readiness

**Not applicable**

This Work does not intentionally change product behavior.

### Design / governance readiness

**PASS**

The proposal has two completed governance-review passes. The second review
resolved the Release Work lifecycle, Work Merge Gate vs Release Promotion Gate,
Ready Queue routing, V1 Task dispatch concurrency, and candidate-specific
release-approval record.

No unresolved design choice must be invented by the Developer for T1–T5.

### Execution readiness

**PASS**

T1–T5 have bounded targets, authoritative sources, ownership constraints, and
clear completion conditions.

The runtime choice and external GitHub activation mechanics are deliberately
excluded into separate downstream Works, so the Developer does not need to
invent them while implementing canonical governance.

### Validation readiness

**PASS**

The implementation is documentation/governance-only. The project validation
owner defines proportional documentation checks: relative links and referenced
paths, formatter / `format:check`, and `git diff --check`.

### Conditional readiness

- security-sensitive: addressed by the accepted credential/publisher boundary;
  implementation of credentials is downstream.
- cross-system: downstream GitHub/OpenAI integration is separately scoped.
- concurrency-sensitive: V1 coordinator-managed Task execution is serialized.
- operationally critical: release authority and merge authority remain
  explicitly separated and human-only gates remain preserved.

### Blockers

None for canonical governance integration.

### Non-blocking risks

- External GitHub enforcement is not yet active after the documentation change.
  This risk is explicitly carried to downstream activation Works and MUST remain
  visible as unavailable operational enforcement until verified.
- Runtime preference (`gh-aw + Codex`) remains a downstream Technical Design
  hypothesis rather than canonical governance.

### Result

`READY`

The approved governance Work may transition:

```text
Preparing
-> Ready
```

Implementation may then begin on T1–T5 without requiring the Developer to make
an unresolved decision outside implementation authority.
