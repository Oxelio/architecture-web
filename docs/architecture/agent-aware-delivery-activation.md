# Technical Design — Activate deterministic agent-aware delivery control plane

**Artifact status:** Proposed — revised during implementation  
**Content status:** Proposed  
**Document type:** Technical Design  
**Domain:** Delivery automation / GitHub operations

## Work context

**Work:** GitHub Issue #9  
**Work Type:** Technical Change  
**Workflow Depth:** Complex  
**Change Characteristics:** security, cross-system, concurrency, operational  
**Current activity:** Implementation with Technical Design correction  
**Authorized functional source:** Not applicable; this Work must preserve product behavior.

**Canonical owners:**

- `docs/project/delivery-pipeline.md` — delivery semantics, operational ownership, routing, claims, gates, and activation rules;
- `docs/project/project-method-profile.md` — project owner resolution and Method adoption;
- `AGENTS.md` — repository agent operational constraints;
- `docs/development/testing.md` — validation policy;
- architecture owners referenced by the Project Method Profile where repository boundaries are affected.

This design implements the existing delivery policy. It does not redefine that policy.

## 1. Scope correction

Implementation evidence established that selecting and operating a concrete coding-agent runtime is a separate material decision from activating the deterministic GitHub control plane. In particular, provider/runtime alternatives can change authentication, cost, scheduling, trust boundaries, availability, and execution topology without changing the delivery policy itself.

Work #9 therefore owns **deterministic control-plane activation**. Selection and production activation of a concrete automated execution runtime/provider are deferred to separate Research / Discovery and any follow-on Technical or Architecture Work that research triggers.

This correction preserves the delivery policy rule that `agent:*` is an execution route/provider assignment only. A route such as `agent:codex` does not freeze a model, runtime framework, credential mechanism, inference provider, or scheduling mechanism.

### In scope for Work #9

- deterministic GitHub Project/repository inventory and activation verification;
- repository-local non-secret activation manifest with explicit inactive/verified mappings;
- operational-state reading for Work/Task lifecycle inputs, route cardinality, dependencies, WIP, native relationships, and Work Integration PR state;
- deterministic Ready Queue and Task-execution eligibility planning;
- Work Integration PR target resolution and fresh ref/SHA/base verification;
- Work-scoped Task execution claim storage, serialized trusted mutation, generation protection, release, and recovery planning;
- fail-closed coordinator observation and dispatch planning;
- deterministic Work Merge Gate and Release Promotion Gate evaluation/publication boundaries;
- separation of privileged Project/repository mutations from untrusted execution contexts;
- live verification of the GitHub primitives that this Work claims to activate;
- repository CI and validation evidence for the control-plane implementation.

### Explicitly deferred from Work #9

- selecting the production coding-agent runtime;
- selecting the inference provider/model or billing/authentication mechanism;
- activating Codex Desktop Automations, `gh-aw`, OpenAI API, OpenRouter, GitHub Copilot, or another executor as the production route implementation;
- provider-specific workflow compilation or generated agent workflow locks;
- end-to-end automated code mutation by a production coding agent;
- automatic fallback between paid/subscription providers;
- production scheduling/polling policy for coding-agent execution.

The deferred topics require evidence and comparison before becoming a new technical target. Existing experimental runtime work in this branch is historical implementation evidence only and is removed from the Work #9 target rather than silently becoming architecture.

## 2. Constraints to preserve

The implementation must preserve these delivery-policy constraints:

- `agent:*` identifies only an execution route/provider and does not encode model, Method Role, human identity, or approval authority;
- automated executors cannot assign or change their own route;
- lifecycle eligibility, dependencies, WIP, route validation, target authorization, claim ownership, merge-gate evaluation, and release prerequisites are deterministic control-plane concerns;
- V1 permits at most one active implementation Task execution per Work across human and automated execution;
- mixed human/automated execution fails closed when active Task ownership cannot be established reliably;
- ordinary execution contexts do not receive privileged Project/merge/release/governance credentials;
- privileged writes use trusted deterministic publishers;
- passing a Work Merge Gate or Release Promotion Gate does not manufacture merge authority or human approval;
- external mappings and enforcement become Current Truth only after their backing mechanisms are implemented, usable, and verified;
- unavailable platform enforcement remains explicitly unavailable rather than being represented as active.

## 3. Technical responsibilities

Work #9 is repository delivery infrastructure, not a product bounded context. It introduces no IAM/business domain model, aggregate, repository port, or application use case.

The implementation is split into four control-plane responsibilities:

1. **Operational inventory and activation verification** — discovers GitHub Project/repository primitives, verifies semantics, and reports whether mappings can become effective.
2. **Deterministic coordinator** — reads operational state and computes lifecycle/dependency/WIP/route/target eligibility without using an LLM.
3. **Trusted publisher** — performs explicitly allowed Project/repository mutations after re-reading authoritative operational state.
4. **Gate evaluator** — computes Work Merge Gate and Release Promotion Gate results from already-established evidence and authority records.

A future executor integration consumes an authorized execution decision from this control plane. Work #9 does not define a universal executor framework or a provider-neutral abstraction beyond the concrete structured decision data already required by the coordinator boundary.

## 4. Operational inventory and activation

Inventory is deterministic and fail-closed.

Project selection:

1. enumerate Projects visible to the configured Projects credential;
2. retain Projects linked to `Oxelio/Architecture-Web`;
3. select the single match, or require an explicit owner/number when selection is zero/ambiguous;
4. verify Project identity again before trusted mutation.

Activation verifies the Project/repository primitives required by `docs/project/delivery-pipeline.md`, including field names/types/options, required views, repository labels, native relationships, claim storage, and capability availability.

Repository-local configuration may record non-secret adapter mappings only after live verification. Platform-generated IDs are discovered/revalidated and are not policy owners.

A missing or unreadable external owner remains unavailable. The implementation must not infer a substitute from Issue text, PR text, chat history, or native GitHub `Status`.

## 5. Coordinator behavior

### 5.1 Ready Queue observation

For Ready Work selection, the coordinator:

1. reads current operational state;
2. verifies required mappings are activated/readable;
3. evaluates lifecycle, dependency, and WIP eligibility;
4. filters candidates by the requested activated `agent:*` route when evaluating an automated executor route;
5. orders otherwise eligible candidates according to Priority and deterministic tie-breaking policy.

A Work Integration PR is not a hidden Ready Queue requirement.

### 5.2 Task execution planning

When an executable Work/Task is being evaluated, the coordinator:

1. verifies exactly one applicable execution route;
2. verifies Task/parent/dependency state when Tasks exist;
3. verifies no conflicting active Task claim;
4. resolves the Work Integration PR target;
5. returns a structured authorized-or-blocked execution decision.

Work #9 stops at deterministic planning/authorization evidence. It does not invoke a production coding-agent runtime.

### 5.3 Stable blockers

Expected unavailability is represented with machine-readable blockers rather than technical exceptions. Examples include:

- Project locator/credential/mapping unavailable;
- route missing/conflicting;
- dependency or WIP blocked;
- claim active/partial/unreadable;
- Work Integration PR missing/ambiguous/untrusted;
- target ref/SHA/base changed;
- required gate evidence unavailable;
- repository enforcement unavailable.

Unexpected API/programming failures remain failures and must not be converted to successful control outcomes.

## 6. Work Integration target authorization

For ordinary repository-writing execution, the structured target source is the Work's single Work Integration Pull Request, not agent output or free-form Issue text.

For Work targeting `development`:

1. locate open same-repository PRs that reference the Work and target `development`;
2. require the head branch to be an ordinary Work branch, not `main`, `development`, or `release/*`;
3. require exactly one candidate;
4. record PR number, head ref, head SHA, base ref, repository identity, and Work-reference evidence;
5. re-read and revalidate this state immediately before any future executor integration is allowed to write.

Authorized release-candidate correction Work follows the same rule with the identified `release/*` base while keeping the correction Work branch as the write target.

Changed/unreadable PR identity, base, ref, SHA, fork identity, closed/merged state, or ambiguity invalidates the previous authorization.

## 7. Task execution claim

V1 uses one Work-scoped active Task execution claim managed exclusively by a trusted publisher and serialized by a Work-specific GitHub Actions concurrency group.

Preferred Project fields on the parent Work item:

- `Active Task`;
- `Execution Claimant`;
- `Execution Claim Generation`;
- `Execution Claim Run`;
- `Execution Claim Acquired At`.

Claim acquisition:

1. re-read Work/claim state inside the Work-specific serialized publisher;
2. prove there is no active claim;
3. resolve and verify the authorized Work Integration target where the requested claim requires a repository write target;
4. write the complete new claim with a new opaque generation;
5. re-read the claim and prove ownership of the same generation.

Claim release is generation-guarded and idempotent. A release must never clear a newer claimant.

V1 has no time-based automatic claim expiry:

- human claims require explicit authorized release/handoff/recovery;
- an automated claim may be reconciled only when terminal execution evidence is readable and the stored generation still matches;
- unreadable execution state remains active/blocking.

The claim protocol may be validated independently of a production coding-agent runtime.

## 8. Gate evaluation

### 8.1 Work Merge Gate

The deterministic Work Merge Gate consumes evidence already established by the responsible review/validation/authority activities. It reports pass/fail plus stable reasons and never merges the PR.

Repository-required enforcement remains a separate capability state. If the repository cannot enforce the check, report `enforcement: unavailable` rather than treating the gate as required Current Truth.

### 8.2 Release Promotion Gate

The Release Promotion Gate verifies the identified Release Work/candidate, beta evidence, candidate-specific Human Release Approval, blockers, applicable checks/protections, and required synchronization evidence.

A pass does not merge or deploy and does not create Human Release Approval.

## 9. Security boundaries

- Project credentials are separate from repository-scoped credentials and are available only to trusted inventory/publisher jobs.
- Pull-request/untrusted execution must not receive the Projects credential.
- Privileged publisher jobs must not execute untrusted repository code before privileged mutations.
- GitHub event payloads are triggers, not authoritative current state; trusted logic re-reads GitHub before decisions/mutations.
- Repository/Issue/PR text is untrusted input to any future agent executor.
- No provider/API credential is required for Work #9 completion because production executor activation is deferred.

## 10. Activation sequence

Activation is incremental and fail-closed:

1. validate repository/Project inventory and baseline reporting;
2. provision the least-privilege Projects credential through the human/operator path;
3. create/repair and verify required Project fields/views, repository labels, and native relationships;
4. mark only successfully verified mappings active in repository-local configuration;
5. verify Work-scoped claim storage and trusted acquire/release/recovery behavior;
6. verify deterministic coordinator observation against live operational state;
7. verify target authorization/revalidation against the Work Integration PR boundary;
8. publish/verify Work Merge Gate evidence while keeping unsupported enforcement explicitly unavailable;
9. verify Release Promotion Gate observation/records where the required backing primitives are available;
10. leave production coding-agent execution inactive until a separate Work establishes and validates an executor profile.

Partial activation remains explicit.

## 11. Validation strategy

Minimum evidence for Work #9:

- deterministic unit tests for Project selection, field/view verification, route cardinality, dependency/WIP ordering, target-ref validation, claim/gate predicates, and blocker results;
- inventory tests for zero/one/multiple Project matches and missing/conflicting primitives;
- target tests for missing/multiple PRs, wrong base, fork head, governed head branch, changed head SHA/ref, and untrusted target override;
- claim concurrency tests for simultaneous acquisition, partial state, generation mismatch, release, reconciliation, unreadable run state, and mixed human/automated fail-closed behavior;
- static inspection of workflow permissions and Projects credential isolation;
- live/sandbox Project verification proving that each mapping marked verified exists and is readable/usable;
- live claim acquire/re-read/release evidence through the trusted publisher without requiring a production coding agent;
- coordinator observation evidence against live activated mappings;
- Work Merge Gate and Release Promotion Gate evidence at their implemented boundaries;
- repository validation commands required by `docs/development/testing.md` for the changed tooling/workflow boundary.

Provider-specific agent execution, model quality, inference compatibility, provider billing, and production agent safe-output validation are evidence requirements of the deferred executor-profile Work, not Work #9.

## 12. Technical decisions and trade-offs

### D-01 — deterministic GitHub control plane remains selected

GitHub remains the operational platform because the canonical delivery policy assigns Work/Task/route/PR operational subjects there. The control plane does not delegate lifecycle, claim, target, or gate decisions to an LLM.

### D-02 — no automatic claim expiry

Rejected. Age does not prove a human claim is abandoned and unreadable automated execution does not prove it is safe to steal. Explicit human recovery and terminal-execution reconciliation are safer.

### D-03 — Work Integration PR is the target source

Selected as the structured execution-target source inside the existing governance boundary. Agent-provided or Issue-text branch selection is rejected.

### D-04 — concrete executor selection is deferred

The earlier branch implementation used `gh-aw` with the Codex engine as an experimental candidate. Further analysis identified material alternatives with different authentication/cost/execution properties, including subscription-backed local/desktop execution and alternate inference providers.

Selecting one production runtime now would exceed the corrected Work #9 scope and would turn an unresolved comparison into implementation truth. The experimental `gh-aw`/Codex workflow and generated locks are therefore removed from this Work. Git history preserves that experiment for the follow-up Research / Discovery Work.

No ADR is required merely to defer this replaceable adapter choice. Re-evaluate the ADR trigger if follow-up research proposes a durable cross-project executor architecture, persistent external control service, or another structural rule whose rationale should be preserved.

## 13. Completion boundary for Work #9

Work #9 may move from `Implementing` toward review only when:

- the deterministic tooling/workflows required by this revised scope are implemented;
- current-head repository CI is green;
- Project-backed mappings intended to become active are live-verified, or remain explicitly inactive with a documented blocker that is outside the accepted completion scope;
- trusted claim acquire/release/recovery has sufficient live/sandbox evidence for the activated claim owner;
- coordinator and target-verification fail-closed behavior has sufficient evidence;
- gate evaluation/publication boundaries required by this scope are implemented and their enforcement availability is represented accurately;
- provider-specific runtime artifacts are absent from the production target of this Work;
- Code Review, Architecture Review, Security Review, and final Validation can proceed against a coherent control-plane target.

Work #9 does **not** require a production coding-agent execution to become Done. That capability requires the separate executor-profile research and any implementation Work it authorizes.

## 14. Follow-up research trigger

Create a separate **Research / Discovery** Work to compare execution profiles without changing this Work's control-plane semantics. The comparison should cover at least:

- Codex Desktop/Automations using ChatGPT subscription access;
- GitHub Actions/`gh-aw` with OpenAI API authentication;
- GitHub Actions/`gh-aw` with GitHub Copilot inference;
- GitHub Actions/compatible runtime with OpenRouter or another OpenAI-compatible endpoint;
- credential isolation, cost model, scheduling/availability, target binding, claim integration, safe mutation, observability, recovery, and model/provider portability.

Research conclusions become implementation/architecture targets only through their proper downstream owner and authority process.
