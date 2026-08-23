# Architecture Web — Agent-Aware Delivery Governance Review

> **Content status:** Working review  
> **Authority:** Non-canonical. This review does not approve governance.  
> **Reviewed target:** `governance-proposal.md`  
> **Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Work State:** Designing  
> **Activity:** Governance Review  
> **Review result:** CHANGES REQUIRED before Human Governance Approval

## 1. Review basis

The review checks the proposal against:
- the Software Engineering Method lifecycle, authority, ownership, Working Decision, review, validation, and readiness semantics;
- the current Architecture Web delivery policy on `development`;
- current GitHub platform constraints relevant to Actions, branch protection, environments, Projects v2, and GitHub Agentic Workflows.

The proposal remains a Proposed Target. It is not Current Truth.

## 2. Findings

| ID | Severity | Subject | Finding | Required disposition |
| --- | --- | --- | --- | --- |
| GR-01 | BLOCKER | `agent:*` ownership | `agent:*` overlaps the existing `Execution assignee -> GitHub native assignees` mapping unless the two subjects are separated. | Define `agent:*` as execution route/provider and GitHub assignees as human identity assignment/accountability. Update the delivery ownership table. |
| GR-02 | BLOCKER | Lifecycle vs automation | The proposal can be read as making `agent:*` a lifecycle/readiness prerequisite. | State explicitly that `agent:*` affects dispatch only. A Work can be `Ready` without an automated agent route. |
| GR-03 | BLOCKER | Agent mutation authority | The proposal defines labels but not who may assign/change them. | Define mutation authority. V1: human assignment or Workflow Coordinator recording an explicitly established/delegated route; no agent self-routing. |
| GR-04 | MAJOR | Method Role separation | Physical agent/provider routing is separate from the Method Role active for an activity. | Require Role/context re-resolution independently from `agent:*`. |
| GR-05 | MAJOR | Work/Task branch model | “One Work Branch” is useful but too rigid if interpreted as forbidding Task branches or multi-repository delivery. | Define one primary Work Integration Branch/PR per repository integration target; Task branches may integrate into it. |
| GR-06 | BLOCKER | Merge Gate authority | The Merge Gate wording risks making the coordinator the semantic owner of review/validation acceptance. | Define the Work Merge Gate as composite enforcement over results established by authorized Roles/Gates; do not let it manufacture those results. |
| GR-07 | MAJOR | Merge lifecycle position | “Lifecycle state permits merge evaluation” is too vague. | V1: Work integration merge is evaluated only while the owning Work is `Validating`. |
| GR-08 | MAJOR | Task completion | “Tasks are concluded” must not mean “any closed issue counts as successful completion.” | Require acceptable terminal disposition for all required in-scope Tasks; rejected/not-planned Tasks require authorized scope disposition. |
| GR-09 | BLOCKER | Credential boundary | `SHOULD NOT receive privileged credentials` is too weak for a security-sensitive governance invariant. | Use MUST for separation of ordinary agent execution from privileged GitHub/Project mutation credentials. |
| GR-10 | MAJOR | Target ref authority | The target ref must not be selected from untrusted agent output. | Require deterministic control-plane selection/validation of the authorized target ref. |
| GR-11 | BLOCKER | Existing branch policy | The proposed `release/* -> main` path changes the current `development -> main` promotion rule but does not explicitly replace/qualify it. | Amend branch policy explicitly: normal stable promotion uses short-lived `release/*`; direct `development -> main` is not the normal beta/stable path. |
| GR-12 | MAJOR | Shared ancestry | Promoting a release branch to `main` can temporarily make `development` not descend from the new `main`. | Require synchronization of `main` back into `development` after release promotion before ordinary integration continues. |
| GR-13 | BLOCKER | Release owner | No operational owner records candidate identity, included scope, beta evidence, and release approval. | Introduce a Release Work as the operational owner for a release candidate/promotion. |
| GR-14 | BLOCKER | Release authority | The V1 release authority is left open. | Proposed resolution: Human Release Approval for an identified candidate after sufficient beta evidence; any candidate change invalidates the approval. |
| GR-15 | MAJOR | Artifact promotion | “Same artifact where technically practical” is directionally correct but underspecified. | Prefer exact immutable artifact promotion; if rebuild is required, Technical Design must establish an explicit equivalence/reproducibility guarantee and validation. No silent rebuild substitution. |
| GR-16 | MAJOR | Runtime ownership | `gh-aw + Codex` is correctly marked non-normative but should not appear in the final durable governance owner as an implementation target. | Keep runtime-neutral governance; move `gh-aw + Codex` to downstream Technical Design / Working Decision scope. |
| GR-17 | MAJOR | Activation/effect | New labels, checks, environments, and relationships are external owners/enforcement and are not effective merely because the policy is merged. | Apply the existing activation rule separately to `agent:*`, Merge Gate enforcement, release environments, and Release Work mappings. |
| GR-18 | MINOR | Normative language | The proposal uses `SHALL`; the existing project delivery policy uses `MUST`, `SHOULD`, `MAY`. | Align with existing normative vocabulary. |

## 3. Recommended V1 governance shape

### Execution routing

```text
Execution route/provider -> agent:* label on executable Work/Task
Human identity assignment -> GitHub native assignees
Method Role               -> resolved from Activity/context, not from agent:*
```

Dispatch semantics:

```text
0 agent:*          -> unassigned; lifecycle may still be valid; no automated dispatch
agent:human        -> human route; no automated dispatch
1 automated agent -> automated dispatch only if its adapter is activated
>1 agent:*         -> conflicting routing; no execution
unsupported route -> assigned but unavailable; surface operational blocker
```

The automated agent MUST NOT assign or change its own `agent:*` route.

### Work integration

```text
development
    |
    v
work/<work-id>-<slug>       # primary Work Integration Branch
    ^
    |
task/<task-id>-<slug>       # optional Task branch
```

Task branches may merge into the Work Integration Branch.

Only the Work-level integration PR normally merges the Work into `development`.

The Work Merge Gate is evaluated in `Validating`.

### Work Merge Gate

The Work Merge Gate is a project-specific composite enforcement mechanism. It does not replace Authority, Quality, or Evidence Gates.

It may pass only when:
- the owning Work is identifiable;
- `Work State = Validating`;
- all required in-scope Tasks have acceptable terminal disposition;
- required dependency blockers are resolved;
- applicable review results are already accepted by their responsible Roles;
- required validation evidence is already sufficient for pre-merge scope;
- applicable prior human authority gates are satisfied;
- no unresolved Working Decision invalidates integration or exceeds delegated implementation authority;
- repository-required checks and mergeability requirements pass.

A passing Work Merge Gate does not grant merge authority and does not imply `Done`.

### Release model

```text
development -> alpha
release/*   -> beta
main        -> production
```

Normal release flow:

```text
Release Work
    |
    +-- identifies candidate ref/commit
    +-- identifies candidate artifact when applicable
    +-- references included Work/release scope
    +-- collects beta evidence
    +-- records Human Release Approval result
    |
    v
release/<version> -> main
    |
    v
production
    |
    v
synchronize main -> development
```

The Release Work is a normal Method Work whose primary intent is operational promotion. Its Work Type is selected by the normal classification rule; for a pure promotion preserving already-authorized behavior, `Technical Change` with `char:operational` is the expected classification. Depth remains risk-based rather than fixed.

### Human Release Approval

V1 proposed authority contract:

- Human Release Approval is a project-defined human-only Authority Gate.
- It applies to one identified release candidate.
- Sufficient beta Evidence Gate results are a prerequisite.
- Approval authorizes promotion of that candidate toward `main` / production; it does not perform the merge or deployment itself.
- A material change to candidate source or artifact identity invalidates the prior approval and requires renewed beta evidence as applicable and a new approval.
- GitHub PR reviews or environment approvals may record/enforce the decision but do not become its semantic owner merely through platform capability.

### Runtime boundary

Durable governance remains runtime-neutral.

Downstream Technical Design may currently prefer:

```text
GitHub Agentic Workflows (gh-aw)
    +
Codex engine
```

with a direct `openai/codex-action` path retained as a fallback option.

This preference is not part of the durable governance rule.

## 4. Platform feasibility notes

Current GitHub capabilities support the intended enforcement model:
- scheduled workflows execute from the default branch, so target refs must remain explicit;
- protected branches/rulesets can require status checks and successful deployments before merge;
- Agentic Workflows are currently public preview, with read-only defaults, safe outputs, isolated secrets, and multiple supported coding-agent engines;
- Agentic Workflow Project updates require a separate write-capable PAT or GitHub App token because the default `GITHUB_TOKEN` lacks Projects v2 access;
- some environment protection features for private repositories depend on the GitHub plan.

These are implementation constraints/evidence, not governance owners.

## 5. Review disposition

The original proposal is not ready for Human Governance Approval.

A revised proposal incorporating GR-01 through GR-18 is suitable for a second governance review.

The largest remaining human authority decision is whether to accept the proposed V1 Human Release Approval contract.
