# Agent-aware delivery — Working Decision Log

> **Content status:** Working artifact  
> **Authority:** Non-canonical temporary workflow memory.  
> **Scope:** Agent-aware GitHub delivery governance and release workflow.

Working Decisions do not override the delivery policy. They are resolved only when integrated into the proper owner, promoted through the appropriate decision mechanism, superseded, dropped, or moved to another Work scope.

## Execution routing

### WD-001 — `agent:*` namespace

**Status:** Provisional  
Use `agent:*` to represent execution route/provider, for example `agent:human`, `agent:codex`, `agent:claude-code`, or future supported agents. The namespace does not encode model, Method Role, runtime, or approval authority.

### WD-002 — Human execution vs human authority

**Status:** Provisional  
`agent:human` means human execution only. It does not represent Human Functional Approval, governance approval, architecture authority, release authority, or PR approval.

### WD-003 — Routing cardinality

**Status:** Provisional  
An executable Work/Task has at most one active `agent:*` route. No route means unassigned; more than one route means conflicting configuration.

### WD-004 — Automation eligibility is not lifecycle eligibility

**Status:** Provisional  
A missing or human execution route does not invalidate an otherwise valid Work State and does not become a hidden Readiness Gate.

### WD-005 — Agent routing authority

**Status:** Provisional  
An automated agent may not assign or change its own execution route. V1 route changes require explicit human assignment or explicit Workflow Coordinator delegation/policy.

### WD-006 — Method Role remains independent

**Status:** Provisional  
The active Method Role is resolved from Activity and Context. `agent:*` selects a physical/technical executor, not a Role.

## Work and Task execution

### WD-007 — Executable-unit rule

**Status:** Provisional  
A lightweight Work without Tasks may be directly executable. When implementation Tasks exist, those Tasks are the executable units and do not inherit an agent route from the parent in V1.

### WD-008 — Task dependency is semantic sequencing

**Status:** Provisional  
When Task ordering is semantically required, represent it explicitly using the activated dependency mechanism. The coordinator must not infer semantic order from AI preference or issue age.

### WD-009 — Deterministic task selection

**Status:** Provisional  
Only open, unblocked, correctly routed Tasks within an eligible parent Work and applicable WIP limits may be dispatched. Non-semantic tie-breaks remain deterministic and belong to Technical Design.

### WD-010 — Initial concurrency

**Status:** Provisional  
V1 keeps execution conservative: one implementing Work under the existing WIP rule and no requirement for parallel Task execution. Later concurrency can be introduced separately.

## Control plane and integration

### WD-011 — Deterministic control plane

**Status:** Provisional  
Work/Task eligibility, dependencies, WIP, routing validation, lifecycle transition validity, target refs, merge eligibility, and release prerequisites are deterministic control-plane responsibilities.

### WD-012 — Work Integration Branch

**Status:** Provisional  
Meaningful Work normally uses one primary Work Integration Branch/PR per repository integration target.

### WD-013 — Optional Task branches

**Status:** Provisional  
Task branches may integrate into the Work Integration Branch. Task-level integration must not bypass Work-level review, validation, or merge requirements by sending partial governed Work directly to `development`.

### WD-014 — Draft PR during implementation

**Status:** Provisional  
The Work Integration PR may exist as Draft during `Implementing` and becomes the Work-level review/integration vehicle.

### WD-015 — Work Merge Gate

**Status:** Provisional  
The Work Merge Gate is evaluated in `Validating` and aggregates already-established authority, review, dependency, and evidence results. It does not manufacture them.

### WD-016 — Merge does not equal Done

**Status:** Provisional  
A passing Work Merge Gate does not grant merge authority and does not imply `Done`. Post-merge synchronization/evidence may remain before Work completion.

## Security and runtime

### WD-017 — Privileged publication boundary

**Status:** Provisional  
Ordinary agent execution must not receive privileged GitHub/Project/merge/release/governance credentials beyond explicitly delegated scope. Privileged writes pass through a trusted publisher or equivalent safe-output boundary.

### WD-018 — Protected control files

**Status:** Provisional  
Governance, agent-control, CI/CD, credential, and other protected project files are not modified by ordinary feature execution unless the authorized Work explicitly includes them and applicable policy permits it.

### WD-019 — Runtime-neutral governance

**Status:** Provisional  
Durable governance remains independent from a specific agent runtime or model.

### WD-020 — Initial runtime target

**Status:** Provisional — downstream Technical Design scope  
Current implementation preference is GitHub Agentic Workflows (`gh-aw`) with Codex as the first engine. Direct `openai/codex-action` remains a fallback/reference path. This is not a durable governance rule.

## Scheduling, release, and environments

### WD-021 — Explicit target ref

**Status:** Provisional  
The branch owning a scheduled control-plane workflow does not determine application branch semantics. The deterministic control plane selects or validates an explicit authorized target ref; untrusted agent output cannot choose it.

### WD-022 — Branches and environments are distinct

**Status:** Provisional  
Preferred branch topology: `development`, short-lived `release/*`, `main`. Preferred environments: `alpha`, `beta`, `production`.

### WD-023 — Staged promotion path

**Status:** Provisional  
Normal staged promotion is `development -> alpha`, `release/* -> beta`, `main -> production`. A permanent `staging` branch is not introduced solely to represent beta.

### WD-024 — Release Work

**Status:** Provisional  
A staged release uses a top-level Release Work as the operational coordination owner for candidate identity/context, release scope references, beta evidence, release approval result, and production evidence. It is a normal Method Work, not a new Work Type.

### WD-025 — Candidate identity and artifact promotion

**Status:** Provisional  
Prefer promotion of the same immutable beta-validated artifact to production. If rebuild is required, Technical Design must establish source identity, reproducibility/equivalence, and required evidence. No silent artifact substitution.

### WD-026 — Human Release Approval

**Status:** Open — recommended for Human Governance Approval  
V1 should use Human Release Approval as a project-defined human-only Authority Gate for one identified beta-validated candidate. It authorizes stable promotion but does not itself merge or deploy. Material candidate change invalidates the approval.

### WD-027 — Release Promotion Gate

**Status:** Provisional  
The normal `release/* -> main` path is protected by a Release Promotion Gate that requires the identified Release Work/candidate, sufficient beta evidence, Human Release Approval for the current candidate, applicable repository protections, and no unresolved release blocker.

### WD-028 — Shared ancestry restoration

**Status:** Provisional  
After promotion to `main`, synchronize `main` back into `development` as necessary before ordinary integration continues, preserving the current shared-ancestry invariant.

## Resolution target

Most entries target `docs/project/delivery-pipeline.md` if Human Governance Approval accepts them. WD-020 belongs to downstream Technical Design instead. After integration into authoritative owners, this log should not remain a competing normative source.
