# Technical Design — Activate deterministic agent-aware delivery control plane

**Artifact status:** Implemented  
**Content status:** Proposed  
**Document type:** Technical Design  
**Domain:** Delivery automation / GitHub operations

## Work context

**Work:** GitHub Issue #9  
**Work Type:** Technical Change  
**Workflow Depth:** Complex  
**Change Characteristics:** security, cross-system, concurrency, operational  
**Authorized functional source:** Not applicable; this Work must preserve product behavior.

**Canonical owners:**

- `docs/project/delivery-pipeline.md` — delivery semantics, operational ownership, routing, claims, gates, and activation rules;
- `docs/project/project-method-profile.md` — project owner resolution and Method adoption;
- `AGENTS.md` — repository agent operational constraints;
- `docs/development/testing.md` — validation policy;
- architecture owners referenced by the Project Method Profile where repository boundaries are affected.

This design implements the existing delivery policy. It does not redefine that policy.

## Current applicability

Work #9 remains historical rationale and implementation evidence for the deterministic delivery control plane.

Once Work #31 becomes effective, the claim-specific parts of this design are superseded for current Architecture Web delivery. This includes mandatory Work-scoped Task execution claims, universal Task serialization, claim acquisition/release/recovery, and claim-specific activation requirements.

Non-claim control-plane design remains applicable where it is consistent with the current canonical delivery policy in `docs/project/delivery-pipeline.md`, including Project inventory, Work State activation, Ready Queue observation, Work Integration target verification, gate evaluation/publication, and privilege separation.

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

- native GitHub Project `Status` is the unique operational adapter for the Method Work State once activated, with exactly the ten Method Work State values and no parallel custom `Work State` field;
- absence of a `Status` value is not interpreted as `Idea` or another state and must fail closed whenever Work State is required;
- GitHub platform automation must not manufacture Method lifecycle transitions from item-add, Issue-close, or Pull-Request-merge events;
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

Activation verifies the Project/repository primitives required by `docs/project/delivery-pipeline.md`, including field names/types/options, required views, repository labels, native relationships, claim storage, and capability availability. For lifecycle ownership specifically, the verifier requires native Project `Status` to expose exactly the ten Method Work State values and verifies the operational views against that field. A missing `Status` value on a Work item remains unavailable rather than being defaulted or inferred.

Repository-local configuration may record non-secret adapter mappings only after live verification. Platform-generated IDs are discovered/revalidated and are not policy owners.

Some GitHub Project settings, including platform-level default values or built-in workflow automation configuration, are not established merely by field/view inventory. Where the available API cannot prove such a setting, activation evidence must retain an explicit operator verification rather than representing that property as machine-verified. The repository verifier still fails closed on every lifecycle primitive it can observe directly.

A missing or unreadable external owner remains unavailable. The implementation must not infer a substitute from Issue text, PR text, chat history, or another Project field.

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
- Work State unavailable because `Status` is absent or invalid;
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

1. re-read Work/Task/claim state inside the Work-specific serialized publisher;
2. prove there is no active claim;
3. require an explicit execution kind (`human` or `automated`) rather than inferring it from claimant text or run metadata;
4. for an automated claim, require the expected `agent:*` executor route and revalidate the freshly read Task route immediately before acquisition; unavailable, unassigned, conflicting, human-only, or mismatched routes block acquisition;
5. for a human claim, do not require an assigned route, but if the activated route owner exposes an explicit route it must be `agent:human`; conflicting or explicitly automated routes block human acquisition;
6. resolve and verify the authorized Work Integration target where the requested claim requires a repository write target;
7. write the complete new claim with a new opaque generation;
8. re-read the claim and prove ownership of the same generation.

The expected automated route is a revalidation input to the trusted publisher, not a route mutation or authority source. The publisher never changes `agent:*` labels during claim acquisition. Human mode likewise cannot override an explicit automated route assignment.

Claim release is generation-guarded and idempotent. A release must never clear a newer claimant.

V1 has no time-based automatic claim expiry:

- human claims require explicit authorized release/handoff/recovery;
- an automated claim may be reconciled only when terminal execution evidence is readable and the stored generation still matches;
- unreadable execution state remains active/blocking.

The claim protocol may be validated independently of a production coding-agent runtime.

## 8. Gate evaluation and publication

### 8.1 Work Merge Gate

The deterministic Work Merge Gate consumes evidence already established by the responsible review/validation/authority activities. It reports pass/fail plus stable reasons and never merges the PR.

Live technical evidence is re-read from GitHub for the owning Work State through native `Status`, dependency state, authorized Work Integration PR target, exact target head SHA, and PR mergeability. Review acceptance, validation sufficiency, Task disposition, prior authority-gate satisfaction, Working Decision resolution, and repository-check sufficiency remain results established by their proper owners/activities. The V1 publisher may record those established results only when an evidence reference is supplied for every asserted `true` result.

A workflow-dispatch input is therefore a **recording instruction**, not semantic authority. The publisher does not prove a review or validation result merely because an operator supplied `true`. Until those evidence owners have a stronger machine-verifiable recording contract, this publication mechanism MUST NOT be represented as required repository enforcement.

Repository-required enforcement remains a separate capability state. For Work #9 the published result reports `enforcement: unavailable` rather than treating the check as required Current Truth.

### 8.2 Release Promotion Gate

The Release Promotion Gate verifies the identified Release Work/candidate, beta evidence, candidate-specific Human Release Approval, blockers, applicable checks/protections, and required synchronization evidence.

The promotion target is derived from the Release Work's cross-referenced, same-repository open `release/* -> main` Pull Request. The candidate source ref/SHA is therefore not supplied by a free-form workflow input.

Human Release Approval is read from the latest marked Release Work comment using this V1 record shape:

```text
<!-- architecture-web:human-release-approval:v1 -->
Authority: Human Release Authority
Decision: APPROVED | REVOKED
Candidate Source Ref: release/...
Candidate Source SHA: <40-hex commit SHA>
Candidate Artifact Identity: <identity> | none
```

The record is accepted only when:

- its author is a GitHub `User`, not a bot identity;
- the author currently has repository role `maintain` or `admin`, matching the canonical maintainer eligibility basis;
- the authority declaration is exactly `Human Release Authority`;
- the decision and candidate identity parse successfully;
- the latest marked record is an approval rather than a revocation;
- the approved candidate identity exactly matches the current promotion candidate.

A permission/record API failure is technical unavailability, not equivalent to missing or denied Human Release Approval. It therefore fails closed as unavailable rather than silently becoming a business/authority outcome.

A passing result does not merge or deploy and does not create Human Release Approval. Work #9 likewise keeps Release Promotion Gate enforcement `unavailable` until the concrete repository enforcement mechanism is separately activated and verified.

### 8.3 Trusted publication boundary

V1 publication uses two separate GitHub Actions jobs rather than one over-privileged job:

1. **Evaluate** runs trusted repository code with read-only repository permissions. The Work Merge evaluator may receive the separate Projects credential because it must read activated Project owners. It produces a bounded gate-result envelope containing gate kind, exact target SHA, result, summary, and context.
2. **Publish** receives the evaluated envelope, has `checks: write`, has no Projects credential, validates the allowed gate kind/check-name pairing and target SHA shape, then publishes the completed Check Run.

The two Check Run names are fixed:

```text
Architecture Web / Work Merge Gate
Architecture Web / Release Promotion Gate
```

The Work Merge check is attached to the exact Work Integration PR head SHA re-read during evaluation. The Release Promotion check is attached to the exact release-candidate source SHA. A later target change therefore does not make an earlier passing check apply to the new candidate.

Neither job receives merge/deployment authority. The publication result is evidence only.

### 8.4 Default-branch bootstrap constraint

GitHub's `workflow_dispatch` event is available only when the workflow file exists on the repository default branch. Architecture Web currently uses `main` as that default branch while ordinary Work integrates into `development`.

Consequently, the manual Task-claim and gate-publisher workflows may be **implemented in `development` before they are operationally dispatchable**, but they do not become Current Truth merely because the files exist there. Their bootstrap sequence is:

1. implement and validate the workflow/tooling through the Work Integration PR and repository CI;
2. integrate the Work into `development` under the normal Work lifecycle;
3. promote the relevant workflow definitions to `main` through the normal release path;
4. only after the workflow path exists on `main`, dispatch the workflow with the explicitly selected authorized ref (for example `development`) and verify the live publisher boundary;
5. keep the corresponding mechanism/enforcement unavailable until that verification succeeds.

This is a GitHub platform constraint, not a reason to change the project's branch semantics or silently bypass release governance. Work #9 may remain open after its Work Integration PR merges while this activation evidence is obtained.

## 9. Security boundaries

- Project credentials are separate from repository-scoped credentials and are available only to trusted inventory/evaluation/publisher paths that require them.
- A job with `checks: write` MUST NOT also receive the Projects credential in the V1 gate-publication boundary.
- Pull-request/untrusted execution must not receive the Projects credential.
- Privileged publisher jobs must not execute untrusted repository code before privileged mutations.
- GitHub event payloads are triggers, not authoritative current state; trusted logic re-reads GitHub before decisions/mutations.
- Repository/Issue/PR text is untrusted input to any future agent executor.
- Gate publication accepts only fixed gate/check identities and exact GitHub-derived target SHAs; a published PASS grants no merge, release, deployment, review, validation, or human-approval authority.
- Expected missing/negative authority evidence may become a gate blocker; unexpected GitHub/API failure remains technical unavailability.
- No provider/API credential is required for Work #9 completion because production executor activation is deferred.

## 10. Activation sequence

Activation is incremental and fail-closed:

1. validate repository/Project inventory and baseline reporting;
2. provision the least-privilege Projects credential through the human/operator path;
3. create/repair and verify required Project fields/views, repository labels, native relationships, and the native `Status` Work State mapping;
4. record operator verification for required GitHub settings that are not machine-observable through the activation inventory, including absence of an implicit lifecycle default and disabled incompatible built-in transition automations;
5. mark only successfully verified mappings active in repository-local configuration;
6. verify Work-scoped claim storage and trusted acquire/release/recovery behavior when the claim workflow is operationally dispatchable;
7. verify deterministic coordinator observation against live operational state;
8. verify target authorization/revalidation against the Work Integration PR boundary;
9. implement Work Merge Gate and Release Promotion Gate publication boundaries while keeping enforcement unavailable;
10. after the publisher workflow paths are present on the default branch, live-dispatch and verify Check Run publication on explicit authorized target refs/candidates;
11. verify Release Promotion Gate Human Release Approval recording against a candidate-specific sandbox/release example when the backing release primitives are available;
12. leave production coding-agent execution inactive until a separate Work establishes and validates an executor profile.

Partial activation remains explicit. A workflow that is implemented but blocked by default-branch bootstrap is not represented as operationally active.

## 11. Validation strategy

Minimum evidence for Work #9:

- deterministic unit tests for Project selection, field/view verification, route cardinality, dependency/WIP ordering, target-ref validation, claim/gate predicates, and blocker results;
- inventory tests for zero/one/multiple Project matches and missing/conflicting primitives;
- lifecycle tests proving native `Status` is the sole mapped Work State field and that missing/invalid Status values fail closed;
- target tests for missing/multiple PRs, wrong base, fork head, governed head branch, changed head SHA/ref, and untrusted target override;
- claim tests proving human claims work without a required route, respect an explicit `agent:human` assignment, cannot bypass an explicitly automated route, and automated claims revalidate route ownership/cardinality/match immediately before acquisition;
- claim concurrency tests for simultaneous acquisition, partial state, generation mismatch, release, reconciliation, unreadable run state, and mixed human/automated fail-closed behavior;
- gate-publication tests for exact SHA binding, allowed gate/check identities, success/failure Check Run publication, Human Release Approval parsing/revocation/maintainer eligibility, and technical-unavailability handling;
- static inspection of workflow permissions and Projects credential isolation, including the evaluate/publish split;
- live/sandbox Project verification proving that each mapping marked verified exists and is readable/usable;
- operator evidence for required Project lifecycle settings that the current inventory API cannot prove directly;
- live claim acquire/re-read/release evidence through the trusted publisher once the default-branch bootstrap prerequisite is satisfied;
- coordinator observation evidence against live activated mappings;
- live Work Merge Gate and Release Promotion Gate publication evidence once their default-branch bootstrap prerequisite is satisfied;
- explicit evidence that unavailable required-check/ruleset enforcement remains represented as unavailable;
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

### D-05 — gate evaluation and Check Run publication use separate privilege domains

Selected. Combining the Projects credential with `checks: write` would create an unnecessary privileged surface. The evaluator owns evidence collection/evaluation; the publisher owns only bounded Check Run publication. The boundary is explicit even though both jobs currently execute in one workflow invocation.

### D-06 — default-branch bootstrap does not change branch governance

Selected. GitHub requires `workflow_dispatch` definitions to exist on the default branch. Rather than changing the default branch or bypassing the release topology for convenience, Architecture Web records these publishers as unavailable until their workflow definitions reach `main` through the normal release path. Once present there, dispatch may explicitly select another authorized ref such as `development`.

### D-07 — claim execution kind is explicit at the trusted publisher boundary

Selected. The publisher must not infer whether an acquisition is human or automated from claimant text, run metadata, or route labels. Human acquisition does not require a route to be assigned, but when the activated route owner contains an explicit route it must select `agent:human`; an automated route cannot be bypassed by claiming in human mode. Automated acquisition carries an expected `agent:*` executor route and validates that expectation against the freshly read Task route immediately before claim mutation. This closes the planning-to-claim route-change window without making route assignment a hidden precondition for ordinary human execution.

## 13. Completion boundary for Work #9

Work #9 may move from `Implementing` toward review only when:

- the deterministic tooling/workflows required by this revised scope are implemented;
- current-head repository CI is green;
- Project-backed mappings intended to become active are live-verified, or remain explicitly inactive with a documented blocker that is outside the accepted completion scope;
- trusted claim acquire/release/recovery has sufficient live/sandbox evidence for any claim owner represented as activated;
- coordinator and target-verification fail-closed behavior has sufficient evidence;
- gate evaluation/publication boundaries required by this scope are implemented, their privilege separation is verified, and their enforcement/dispatch availability is represented accurately;
- default-branch bootstrap dependencies are explicit: no `workflow_dispatch` publisher is claimed operational before the same workflow path exists on `main` and a live dispatch has succeeded;
- provider-specific runtime artifacts are absent from the production target of this Work;
- Code Review, Architecture Review, Security Review, and final Validation can proceed against a coherent control-plane target.

Work #9 does **not** require a production coding-agent execution to become Done. It also does not require unavailable repository enforcement to be invented. Any implemented publisher that cannot yet satisfy its default-branch bootstrap prerequisite remains explicitly unavailable until normal release promotion makes live verification possible.

## 14. Follow-up research trigger

Create a separate **Research / Discovery** Work to compare execution profiles without changing this Work's control-plane semantics. The comparison should cover at least:

- Codex Desktop/Automations using ChatGPT subscription access;
- GitHub Actions/`gh-aw` with OpenAI API authentication;
- GitHub Actions/`gh-aw` with GitHub Copilot inference;
- GitHub Actions/compatible runtime with OpenRouter or another OpenAI-compatible endpoint;
- credential isolation, cost model, scheduling/availability, target binding, claim integration, safe mutation, observability, recovery, and model/provider portability.

Research conclusions become implementation/architecture targets only through their proper downstream owner and authority process.