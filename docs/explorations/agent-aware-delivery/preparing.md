# Agent-aware GitHub delivery — Preparing record

> **Content status:** Working artifact  
> **Authority:** Non-canonical preparation/readiness record  
> **Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Current Work State:** Preparing  
> **Activity:** Context Resolution + Task Planning + Readiness Review  
> **Approved Target:** `governance-proposal.md` blob `c28d487bd0f6d074406fe614fea03bdddd9c56a2`

## 1. Authority result

The amended target passed independent Governance Review with `PASS` and received renewed Human
Governance Approval on 2026-08-23 for the exact blob above.

The previous approval for blob `97a92896ec722e6a305e12eb7185493ca2eee522` is historical only.

The approved target is not Current Truth until integrated into the canonical delivery owner and
merged through the repository's authorized process.

## 2. Context Manifest

### Context status

`RESOLVED`

### Authoritative context

- `docs/project/project-method-profile.md` — resolves canonical project owners.
- `docs/project/delivery-pipeline.md` — owns current Architecture Web delivery governance.
- repository-pinned `external/software-engineering-method/` — owns lifecycle, Work classification,
  roles, ownership, Working Decision, Readiness, review, and validation semantics.
- `AGENTS.md` — repository operational instructions for agents.
- `docs/ai/coding-agent-guidelines.md` — coding-agent execution guidance.
- `docs/development/testing.md` — validation policy and proportional documentation checks.

### Required working context

- `governance-proposal.md` — exact Approved Target for this Work.
- `governance-review.md` — independent Governance Review evidence (`PASS`).
- `approval.md` — attributable renewed Human Governance Approval.
- `working-decisions.md` — temporary decision memory to resolve during/after integration.

### Missing / conflicting context

None blocks canonical governance integration.

External GitHub activation, runtime selection, claim/lease implementation, publisher credentials,
merge-gate enforcement, release environments, and concrete agent adapters remain intentionally
downstream and do not require the canonical-policy implementer to invent governance semantics.

## 3. Task Plan

### T1 — Integrate approved rules into `governance.delivery`

Target: `docs/project/delivery-pipeline.md`.

Integrate the exact approved governance semantics while reconciling existing wording so the
canonical owner contains no contradictory variants. In particular integrate:

- `agent:*` route/provider ownership and authority boundaries;
- Ready Queue / executor-specific dispatch ordering;
- V1 one-active-Task-per-Work concurrency across human and automated execution;
- Work Integration Branch / PR policy;
- Work Merge Gate semantics;
- privileged publisher / protected control-file boundary;
- scheduled control plane / explicit target-ref rules;
- staged `development -> alpha`, `release/* -> beta`, `main -> production` topology;
- Release Work, candidate identity/artifact guarantees, Human Release Authority/Approval, Release
  Promotion Gate, and shared-ancestry restoration;
- runtime neutrality and external-owner activation semantics.

Do not copy `gh-aw + Codex` into durable governance.

### T2 — Update dependent agent guidance only where required

Inspect `AGENTS.md` and `docs/ai/coding-agent-guidelines.md`. Change them only where the new
canonical delivery policy would otherwise conflict with their operational guidance. Prefer a
reference to `docs/project/delivery-pipeline.md` over duplicated normative rules.

### T3 — Governance Compliance Review

After T1/T2, independently compare the canonical patch against the exact Approved Target and
current applicable project governance. This is a Review activity, not documentation Validation.

### T4 — Documentation Validation

Use the smallest sufficient validation set owned by `docs/development/testing.md`:

- validate relative Markdown links and referenced paths;
- run formatting / `pnpm format:check`;
- run `git diff --check`;
- inspect the diff for unintended unrelated changes.

Application build/test commands are not required merely because governance Markdown changed,
unless implementation scope expands into executable code/configuration.

### T5 — Resolve working memory and close exploration

After canonical integration passes Review and Validation:

- mark accepted Working Decisions integrated into their durable owner;
- move WD-023 to downstream Technical Design scope;
- leave no unresolved Working Decision for the completed governance scope;
- remove this exploration from the active index and remove temporary working artifacts rather than
  retaining them as parallel normative governance.

### T6 — Create/continue downstream implementation Works

External GitHub mappings, Task execution-claim mechanics, baseline CI where needed, deterministic
coordinator, privileged publisher, first runtime adapter, Work Merge Gate enforcement, release
environments, Human Release Approval recording, and Release Promotion Gate enforcement remain
separate Works with their own classification/design/readiness.

## 4. Readiness Review

### Prerequisite gates

- independent Governance Review: **PASS**
- renewed Human Governance Approval: **PASS**
- Functional approval: **not applicable**
- ADR approval: **not triggered for this pure governance scope**

### Authority Readiness

**PASS**

The exact amended target has explicit human authority. No canonical-policy task requires the
Developer to invent who may exercise Human Release Approval or whether human/automated Tasks may
execute concurrently.

### Functional Readiness

**Not applicable**

The Work does not intentionally modify product behavior.

### Design / Governance Readiness

**PASS**

The amended target resolves the prior Human Release Authority and mixed Task-concurrency blockers.
The independent Governance Review found no remaining required correction before approval.

### Execution Readiness

**PASS**

T1–T5 have bounded owners, targets, constraints, and completion conditions. Runtime, GitHub
mechanics, locks/leases, credentials, environments, and operational activation are explicitly
downstream rather than hidden decisions for the canonical-policy implementer.

Working Decision entries remain temporary memory, but their governing choices now have human
authority in the exact Approved Target; they do not require new out-of-authority decisions from
implementation.

### Validation Readiness

**PASS**

The validation owner explicitly defines proportional documentation checks: relative links/paths,
formatter or `format:check`, and `git diff --check`. Governance compliance is kept as a separate
Review activity.

### Conditional Readiness

- security-sensitive: privileged publication and protected-control boundaries are approved; concrete
  credentials/publisher implementation is downstream;
- cross-system: external GitHub/OpenAI/runtime activation remains separately scoped;
- concurrency-sensitive: V1 governance now serializes all active Task execution per Work;
- operationally critical: release authority, release approval, promotion gate, and merge authority
  remain explicitly separated.

### Blockers

None.

### Non-blocking risks carried downstream

- external enforcement is not active until verified;
- Task execution-claim mechanism is not active until implemented/verified;
- runtime preference remains a downstream Technical Design choice.

### Result

```text
READY
```

The Work may transition:

```text
Preparing
-> Ready
```

Canonical governance implementation may begin without requiring the implementer to make an
unresolved decision outside implementation authority.
