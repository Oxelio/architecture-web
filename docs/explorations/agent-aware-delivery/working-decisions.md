# Agent-aware delivery — Working Decision Log

> **Content status:** Working artifact  
> **Authority:** Non-canonical temporary workflow memory.  
> **Scope:** Agent-aware GitHub delivery governance and release workflow.

Working Decisions do not override `docs/project/delivery-pipeline.md`. They remain provisional until accepted conclusions are integrated into the proper authoritative owner, promoted through an appropriate decision mechanism, superseded, dropped, or moved to a separate Work scope.

## Execution routing

### WD-001 — `agent:*` namespace

**Status:** Provisional  
Use `agent:*` to represent execution route/provider. It does not encode model, Method Role, runtime, or approval authority.

### WD-002 — Human execution vs human authority

**Status:** Provisional  
`agent:human` means human execution only. It does not represent Human Functional Approval, governance approval, architecture authority, release authority, or PR approval.

### WD-003 — Routing cardinality

**Status:** Provisional  
An executable Work/Task has at most one active `agent:*` route. No route is unassigned; more than one route is conflicting.

### WD-004 — Automation eligibility is not lifecycle eligibility

**Status:** Provisional  
Missing routing or `agent:human` does not invalidate an otherwise valid Work State and does not become a hidden Readiness Gate.

### WD-005 — Routing mutation authority

**Status:** Provisional  
An automated agent may not assign or change its own execution route. V1 route mutation requires explicit human assignment or explicit Workflow Coordinator authority/delegation.

### WD-006 — Method Role remains independent

**Status:** Provisional  
The active Method Role is resolved from Activity and Context. `agent:*` selects a physical/technical executor, not a Role.

## Work and Task execution

### WD-007 — Executable-unit rule

**Status:** Provisional  
A lightweight Work without implementation Tasks may itself be executable. When implementation Tasks exist, those Tasks are the executable implementation units and do not inherit the parent's route in V1.

### WD-008 — Task dependency is semantic sequencing

**Status:** Provisional  
When Task order matters semantically, use the activated dependency mechanism. The coordinator must not infer semantic ordering from AI preference or issue age.

### WD-009 — Deterministic Task selection

**Status:** Provisional  
Only open, unblocked, correctly routed Tasks within an eligible parent Work and applicable WIP policy may be dispatched. Non-semantic tie-breaks are deterministic.

### WD-010 — V1 coordinator-managed Task concurrency

**Status:** Provisional  
Coordinator-managed Task execution is serialized within a Work. A second dispatched Task is not started while another dispatched Task for the Work is active unless a human explicitly authorizes a bounded delivery exception.

## Control plane and integration

### WD-011 — Deterministic control plane

**Status:** Provisional  
Work/Task eligibility, dependencies, WIP, routing validation, target-ref validation, lifecycle transition validity, merge-gate evaluation, and release prerequisites are deterministic control-plane responsibilities.

### WD-012 — Ready Queue vs executor-specific dispatch

**Status:** Provisional  
Ready Queue membership remains lifecycle/delivery owned. Automated dispatch filters otherwise eligible Work by compatible activated `agent:*` route, then applies existing Priority and deterministic tie-break policy within that executor-compatible set.

### WD-013 — Work Integration Branch

**Status:** Provisional  
Meaningful repository Work normally uses one primary Work Integration Branch/PR per repository integration target.

### WD-014 — Optional Task branches

**Status:** Provisional  
Task branches may integrate into the Work Integration Branch. Task-level integration must not bypass Work-level review, validation, or merge requirements by sending partial governed Work directly to `development`.

### WD-015 — Draft PR during implementation

**Status:** Provisional  
A Work Integration PR may exist as Draft during `Implementing`.

### WD-016 — Work Merge Gate

**Status:** Provisional  
The Work Merge Gate is evaluated in `Validating` and composes already-established authority, review, dependency, and evidence results. It does not manufacture them.

### WD-017 — Work Merge Gate scope

**Status:** Provisional  
The Work Merge Gate governs Work Integration PRs into authorized integration targets, including release-fix Work targeting `release/*`. It does not govern the Release Work's stable promotion PR from `release/*` to `main`.

### WD-018 — Merge does not equal Done

**Status:** Provisional  
Passing the Work Merge Gate does not grant merge authority and does not imply `Done`. Post-merge synchronization/evidence may remain.

### WD-019 — V1 automatic merge authority

**Status:** Provisional  
V1 grants no automatic merge authority merely from an agent result, Work Merge Gate, or Release Promotion Gate.

## Security and runtime

### WD-020 — Privileged publication boundary

**Status:** Provisional  
Ordinary agent execution must not receive privileged GitHub/Project/merge/release/governance credentials beyond explicitly delegated scope. Privileged writes pass through a trusted publisher or equivalent safe-output boundary.

### WD-021 — Protected control files

**Status:** Provisional  
Governance, agent-control, CI/CD, credential, and other protected project files are not modified by ordinary feature execution unless the authorized Work explicitly includes them and applicable policy permits it.

### WD-022 — Runtime-neutral governance

**Status:** Provisional  
Durable delivery governance remains independent from a specific agent runtime or AI model.

### WD-023 — Initial runtime target

**Status:** Provisional — downstream Technical Design scope  
Current implementation preference is GitHub Agentic Workflows (`gh-aw`) with Codex as the first engine. Direct `openai/codex-action` remains a fallback/reference path. This is not a durable governance rule.

## Scheduling, branches, releases

### WD-024 — Explicit target ref

**Status:** Provisional  
The branch owning a scheduled workflow does not determine application branch semantics. The deterministic control plane selects or validates an explicit authorized target ref; untrusted agent output cannot choose it.

### WD-025 — Branches and environments are distinct

**Status:** Provisional  
Preferred branches are `development`, short-lived `release/*`, and `main`. Preferred environments are `alpha`, `beta`, and `production`.

### WD-026 — Staged promotion path

**Status:** Provisional  
Normal staged promotion is `development -> alpha`, `release/* -> beta`, `main -> production`. A permanent `staging` branch is not introduced solely to represent beta.

### WD-027 — Release Work

**Status:** Provisional  
A staged release uses a top-level Release Work as the operational coordination owner for candidate identity/context, release-scope references, beta evidence, release approval result, and production evidence. It is a normal Method Work, not a new Work Type.

### WD-028 — Candidate identity and artifact promotion

**Status:** Provisional  
Prefer promotion of the same immutable beta-validated artifact to production. If rebuild is required, downstream Technical Design must establish immutable source identity, reproducibility/equivalence, and required evidence. No silent substitution.

### WD-029 — Human Release Approval

**Status:** Provisional — concept approved in the prior target; amended authority contract requires renewed Human Governance Approval  
V1 uses Human Release Approval as a project-defined human-only Authority Gate for one identified beta-validated candidate. It authorizes stable promotion but does not itself merge or deploy. Material candidate change invalidates the approval.

### WD-030 — Candidate-specific approval record

**Status:** Provisional  
Human Release Approval must be attributable to the human release authority and identify the Release Work, approved source/ref, and artifact identity when applicable. Generic or stale approval is insufficient.

### WD-031 — Release Promotion Gate

**Status:** Provisional  
The normal `release/* -> main` promotion is protected by a Release Promotion Gate requiring the identified Release Work/candidate, sufficient beta evidence, Human Release Approval for that candidate, applicable repository protections, and no unresolved release blocker.

### WD-032 — V1 Release Work route

**Status:** Provisional  
Representative staged Release Work route:

```text
Idea
-> Preparing
-> Ready
-> Implementing
-> Validating
-> Awaiting Approval
-> Implementing
-> Validating
-> Done
```

The first `Implementing` phase creates/deploys the candidate; the first `Validating` phase establishes beta evidence; `Awaiting Approval` holds Human Release Approval; the second `Implementing` phase promotes/synchronizes; the final `Validating` phase checks production/promotion/synchronization evidence.

### WD-033 — Shared ancestry restoration

**Status:** Provisional  
After promotion to `main`, synchronize `main` back into `development` as necessary before ordinary integration continues so the current shared-ancestry invariant remains satisfied.

### WD-034 — V1 Human Release Authority holder

**Status:** Provisional — requires renewed Human Governance Approval  
For V1, Human Release Authority is held by a human Architecture Web maintainer explicitly acting in the release-authority role for the identified candidate. Repository maintainer status defines eligibility to hold the authority; GitHub merge/review/deployment capability alone does not constitute candidate-specific Human Release Approval.

**Target Owner:** `docs/project/delivery-pipeline.md`

**Resolution Trigger:** Human Governance Approval of the amended governance target.

### WD-035 — V1 mixed human/automated Task serialization

**Status:** Provisional — requires renewed Human Governance Approval  
V1 permits at most one active implementation Task execution per Work, regardless of `agent:human` or automated routing. Every executor must establish an active Task execution claim before beginning. Automated dispatch is blocked while any Task for the Work has an active claim. The concrete claim/lease representation belongs to downstream activation/Technical Design.

If the claim mechanism is not implemented and verified, automated dispatch must not assume that a mixed human/automated Work is idle when human activity cannot be reliably observed.

**Target Owner:** `docs/project/delivery-pipeline.md`

**Resolution Trigger:** Human Governance Approval of the amended governance target.

## Resolution target

If Human Governance Approval accepts the amended proposal:

- WD-001 through WD-022 and WD-024 through WD-035 target `docs/project/delivery-pipeline.md` or the minimal dependent guidance that references it;
- WD-023 moves to downstream Technical Design and must not be copied into durable delivery governance;
- accepted Working Decisions should be resolved/integrated rather than retained as a competing normative source;
- external GitHub mappings/enforcement still require separate activation and verification before becoming Current Truth.
