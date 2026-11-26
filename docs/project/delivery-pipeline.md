# Architecture Web — Delivery profile

> **Content status:** Canonical
>
> **Document type:** Project Governance
>
> **Domain:** Delivery / Architecture

> Work #58 established the main-only delivery policy. The effective GitHub
> controls are documented below with their operational evidence.

## 1. Purpose

Architecture Web adopts the generic [Software Engineering Method](../../external/software-engineering-method/README.md).
The method owns Work Types, Workflow Depth, Work States, Activities, artifact
triggers, gates, AI roles, Context Manifest semantics, Readiness Review,
Working Decision Log, Review, Validation, and the distinction between lifecycle
and delivery planning.

This document owns Architecture Web's **project-specific delivery policy**. It
binds method semantics to GitHub without making GitHub the universal source of
product, architecture, governance, implementation, or evidence truth.

See also the [Project Method Profile](project-method-profile.md).

## 2. Delivery platform and ownership

Architecture Web uses GitHub as its operational delivery platform. Operational
ownership is assigned per subject:

```text
Work identity                    -> top-level GitHub Issue
Work operational objective /     -> top-level GitHub Issue
execution scope
Work State                       -> GitHub Project native field: Status
Work Type                        -> GitHub Project field: Work Type
Workflow Depth                   -> GitHub Project field: Workflow Depth
Priority                         -> GitHub Project field: Priority
Change Characteristics           -> GitHub Issue labels: char:*
Human identity assignment         -> GitHub native assignees
Work dependency/blocker relation -> GitHub native relationship when represented;
                                   otherwise Work Issue operational context
Work closure disposition         -> GitHub Issue state / state reason
Task identity                    -> GitHub Sub-issue
Task parent relationship         -> GitHub native Sub-issue relationship
Task execution context           -> Task Sub-issue
Task completion                  -> GitHub Sub-issue open/closed state
Release identity / traceability   -> GitHub Release and attached release manifest
Delivery ordering                -> GitHub Project
Implementation/review vehicle    -> Pull Request
```

The Work Issue owns only the operational objective and execution scope needed to
coordinate the Method Work. It MUST NOT become the owner of product behavior,
functional scope, architecture decisions, governance policy, or validation truth
that is assigned to another canonical owner.

### Repository branch policy

`main` is the only permanent branch, repository default and integration target.
Ordinary Work uses temporary branches from `main` and integrates through a Work
Integration Pull Request. Delete a completed branch after its work is conserved.
No permanent `development`, staged `release/*` or environment branch is required.

Work Integration Pull Requests use GitHub-native squash merge on protected
`main`. Follow the [integration policy](#native-work-integration) for merge
authority, independent reviews and candidate-bound validation. Work integration,
Work completion, source release publication and deployment each require their
own evidence.

Do not force-update or replace `main` or discard unique commits during transition.
A history rewrite still requires separate explicit human governance authority.
Future environments may consume different immutable SHA/tag identities from the
same branch; their activation does not require adding permanent branches.

#### Required checks on `main`

The active
[`protected` ruleset](https://github.com/Oxelio/architecture-web/rules/21839336)
targets the default branch and enforces PR-only squash integration, with no
bypass and with ref creation, deletion and non-fast-forward protections. It
requires the following checks:

| Required check             | Expected provider | Integration ID |
| -------------------------- | ----------------- | -------------- |
| `Quality checks`           | GitHub Actions    | `15368`        |
| `SonarCloud Code Analysis` | SonarQube Cloud   | `12526`        |

Strict required-status-check policy is enabled. The PR branch must be up to date
with `main`, and required results must apply to the current candidate under that
policy. Updating the candidate or integration base requires current check evidence;
stale success is insufficient. Check names and provider identities are part of
the requirement.

The Actions job `SonarQube Cloud analysis` retains `continue-on-error: true` and
is excluded from the `Quality checks` aggregate. Its tolerated failure or skip
does not satisfy the separate required external `SonarCloud Code Analysis`
check. A failed external Sonar Quality Gate blocks merge. A missing, pending,
cancelled or unavailable analysis leaves the Sonar merge requirement unsatisfied;
a green Actions workflow alone does not establish mergeability.

Fork and Dependabot PRs currently have no Sonar analysis path compatible with
this required external check: the credential-bearing job deliberately excludes
them. Such PRs remain blocked unless a compatible path is separately designed,
accepted and activated. Do not expose secrets, weaken checks or infer a bypass
from this limitation. The [CI guide](../development/continuous-integration.md)
owns analysis diagnostics and configuration instructions.

These results provide candidate-bound evidence for the applicable review and
validation activities. The authority for accepting reviews, establishing
validation sufficiency, authorizing merge and recording completion stays with
the responsible Roles and authorities. Source release publication follows
[its own policy](#13-automatic-coordinated-source-releases).

#### Accepted transition from the previous topology

The maintainer explicitly accepted Work #58's complete implementation plan on
2026-10-29. The accepted target authorizes a merge-commit transition PR preserving
all selected `development` history and introducing this policy on `main`, without
using the former staged-release/beta/Human Release Approval route. Ordinary PR
review and sufficient candidate-bound pre-merge validation remain prerequisites.
The maintainer subsequently explicitly accepted automated pre-merge validation
for this Work and ordinary Work integration, under the scope and evidence rules
in [Testing and verification](../development/testing.md). Human re-execution is
not required for checks sufficiently covered by successful automation. This is a
one-time topology transition, not permission to rewrite history or bypass checks.

Inventory remote and local divergence before transition. Delete `development`
only after verifying that its tip is an ancestor of `main`; delete other branches
only when their work is conserved. Surface unmerged work instead of deleting it.
The source-release workflow becomes available after normal integration; verify
its live behavior before claiming activation. No deployment is part of this Work.

### External-owner activation

An external ownership assignment in this profile is effective Current Truth only
when the backing GitHub primitive exists, is usable for the assigned subject, and
has been verified against this policy. Merging this document does not by itself
make a missing or unverified external owner operational.

Until an assignment is activated, this profile owns the accepted/project target
mapping for that subject, while the effective operational owner MUST be treated
as unavailable rather than inferred or replaced by chat history, PR text, or a
parallel ad hoc field.

Initial activation of Project-backed fields, labels, views, relationships,
required checks, environments, and privileged publisher credentials therefore
requires separate delivery/governance implementation and verification. That step
MUST verify at least the configured field names and values, applicable
labels/relationships, the native `Status` Work State mapping, required checks,
and the intended Project views before an external owner or
enforcement mechanism is treated as effective. Project lifecycle settings that
cannot be
proved through the available inventory API require explicit operator evidence
rather than an implicit machine-verification claim.

If an activated external owner later becomes unreadable or unusable, surface a
synchronization/availability problem. Do not silently create a competing owner.

When a dependency or blocker becomes represented by a native GitHub relationship,
that relationship becomes the operational owner for that relation and any Issue
body wording becomes contextual only.

Derived displays such as linked pull requests and Sub-issue progress MAY be shown
in the Project, but they do not become competing owners of their underlying
relationships.

These operational owners reference, rather than replace, durable owners:

```text
Approved product behavior      -> Functional Specification
Technical target               -> Technical Design
Durable structural rationale   -> ADR
Current architecture           -> current architecture documentation
Implementation                 -> code
Validation evidence            -> tests / CI / reports / other evidence
```

GitHub is canonical only for operational subjects whose assignment is explicit
here and effectively activated according to the rule above.

## 3. Work and Task representation

### Work Issue

A top-level GitHub Issue is the operational owner of one Method **Work** when
that assignment is effectively activated. It owns only the information needed to
identify, contextualize, coordinate, and close that Work.

The Issue body SHOULD remain lightweight:

```text
Operational objective / execution scope
<what operational outcome this Work is coordinating>

Canonical owners
- <Functional Specification when applicable>
- <Technical Design when applicable>
- <ADR / architecture / governance owners when applicable>

Operational context
- dependencies / blockers that are not already represented structurally
- short notes needed to understand execution

Done evidence
- links to PRs, validation evidence, or other completion evidence when useful
```

Do not copy complete Functional Specifications, Technical Designs, ADRs, or
other normative documents into the Issue body.

The Issue body MAY summarize classification or delivery values for readability,
but those summaries are non-authoritative when the ownership table above assigns
the subject to a Project field, label, native relationship, or other GitHub
property.

### Task Sub-issue

A GitHub Sub-issue represents a Method **Task** when Task Planning is triggered
and that operational mapping is available. It is not a second Work and does not
own a separate Work State, Work Type, Workflow Depth, or Priority.

For `Quick` work, the top-level Issue MAY be a sufficient execution unit and no
artificial Sub-issue is required.

For `Standard` or `Complex` work, create Sub-issues only when implementation
requires delegation, sequencing, or independently verifiable units. Use the
[Task template](templates/task.md) as body guidance.

Task Sub-issues SHOULD NOT be added to the Architecture Web Project as independent
Work items by default. Their native parent relationship and open/closed state own
Task structure and completion, while the parent Work may expose derived
Sub-issue progress in Project views.

If a future project policy intentionally adds Task Sub-issues as Project items,
it MUST define dedicated Task field semantics and MUST NOT apply Work State,
Work Type, Workflow Depth, or Priority as though each Task were a separate Work.

### Authorized execution handoff

An authorized maintainer-directed handoff selects a human, coding agent, or
permitted delegate for an authorized Work or Task. The selection belongs to the
working handoff context. Record the Work/Task identity, active Role, scope and
applicable constraints. Existing authority and coordination rules govern Task
selection and executor changes.

Method Role remains independent from the physical executor. The active Role is
resolved from Activity and Context. A material Activity or Role change SHOULD
trigger focused context re-resolution. Execution remains subject to the applicable
authorization, Work State, scope, dependencies, WIP, target ref, and operational
permissions. Executors MUST stay within the authorized assignment, including
when delegating or changing executor.

The `agent:*` mapping is inactive. Any residual labels are historical metadata.
Zero, one or multiple such labels have no effect on normal Work or Task
execution, selection, authority, exclusivity, or lifecycle. A handoff requires
no persistent executor label, field, assignment, inheritance, or claim.

A lightweight Work without implementation Tasks MAY itself be executable. When
implementation Tasks exist, those Tasks are the executable units. Semantic Task
order MUST use the activated dependency mechanism. Implementation-defined
tie-breaks MUST be deterministic. Task closure alone does not prove successful
completion when its disposition does not satisfy the authorized Task plan.

#### Human-directed Task execution

Human-directed Task execution is the active delivery model. When implementation
Tasks exist inside an `Implementing` Work, a human selects an executable Task from
the authorized Task plan and coordinates its execution.

Ordinary human execution MUST NOT require a Work-scoped Task execution claim,
lease, lock, generation, heartbeat, or equivalent machine-owned Task state. The
project has no universal single-active-Task invariant inside one Work. Semantic
ordering and permitted parallelism are established by the authorized Task plan
and activated Task dependencies.

Native assignees MAY communicate responsibility or visibility, but they do not
own exclusivity, lifecycle, execution authority, or a replacement Task lock. Task
open/closed state and disposition remain execution evidence and do not create a
Task-level Method Work State.

If a specific Work requires Task serialization for semantic or technical reasons,
its Task plan, dependencies, or Technical Design MUST express that constraint for
that Work rather than relying on a project-wide concurrency protocol.

Autonomous Work and Task dispatch is inactive. Any future autonomous execution
requires separately accepted Governance and Technical Design scope before
activation, including applicable selection, concurrency, recovery and scheduling
requirements.

## 4. Work State

Once effectively activated, the GitHub Project native field `Status` is
Architecture Web's unique operational owner of the Method Work State. The
Project MUST NOT maintain a parallel custom `Work State` field.

Allowed `Status` values are exactly:

```text
Idea
Exploring
Designing
Awaiting Approval
Preparing
Ready
Implementing
Reviewing
Validating
Done
```

`Status` has no project-defined default value. An item being added to the Project
does not establish `Idea` or any other Method Work State. A missing `Status`
means the Work State is operationally unavailable/unclassified; deterministic
coordination and automated execution MUST fail closed whenever a Work State is
required.

A Work State mutation is permitted only when the Method transition rule and all
applicable gates are satisfied. Project tooling MUST NOT move Work merely
because an API operation is available.

GitHub built-in automations MUST NOT assign or transition `Status` solely because
an item is added, an Issue is closed, or a Pull Request is merged. In particular,
Issue closure or PR merge MUST NOT automatically manufacture `Done`.

The policy applies to both forward transitions and Method-valid returns to an
upstream state. Returning upstream after a later finding is normal lifecycle
behavior and MUST be recorded when the responsible Role/activity has established
that return.

## 5. Classification and delivery fields

Once their assignments are effectively activated, the Project SHOULD expose:

```text
Title
Assignees
Labels (including Change Characteristics)
Status (Method Work State)
Work Type
Workflow Depth
Priority
Linked pull requests
Sub-issues progress
```

### Work Type

The activated Project field `Work Type` is the unique operational owner of the
Work's current classification. Its values are the Method Work Types defined in
[Work classification](../../external/software-engineering-method/work-classification.md).

### Workflow Depth

The activated Project field `Workflow Depth` is the unique operational owner of
the Work's current depth classification.

Single-select:

```text
Quick
Standard
Complex
```

Workflow Depth represents decision/change risk, not estimated duration, story
points, or diff size.

### Priority

The activated Project field `Priority` is the unique operational owner of
delivery priority.

Single-select:

```text
P0 — Critical
P1 — High
P2 — Normal
P3 — Low
```

Priority affects delivery ordering only. It does not bypass authority,
readiness, review, or validation gates.

Priority MAY be proposed by any Role with sufficient context. Changing the
operational Priority requires delivery-coordination permission from project
policy or explicit human delegation. When that permission is not established,
AI recommends the change instead of applying it.

### Change Characteristics

When the label mapping is effectively activated, GitHub Issue labels with the
`char:*` prefix are the unique operational owner of which Method Change
Characteristics are currently assigned to the Work:

```text
char:security
char:privacy
char:migration
char:breaking
char:performance
char:cross-system
char:concurrency
char:destructive
char:operational
char:compliance
```

Labels classify characteristics only; they do not replace Work Type or Workflow
Depth.

## 6. Planning model

Architecture Web uses **Continuous Flow** by default. Delivery planning and
lifecycle execution remain distinct:

```text
Delivery planning

Backlog
   |
   | Work State becomes Ready
   v
Ready Queue
   |
   | execution capacity pulls Work
   v

Lifecycle execution

Implementing -> Reviewing -> Validating -> Done
```

`Backlog` and `Ready Queue` are delivery-planning concepts, not additional Work
States.

The model is pull-based and does not require sprints, iterations, estimates,
story points, or deadlines.

Delivery selection policy:

1. Only Work whose Method Work State is `Ready`, represented operationally as
   `Status = Ready`, is eligible for the Ready Queue.
2. Dependencies and WIP policy remove Work that cannot currently execute.
3. Among the remaining Work, lower Priority number wins (`P0` before `P1`, etc.).
4. At equivalent dependency and Priority conditions, explicit manual ordering,
   age, or another implementation-defined deterministic tie-break MAY decide.
5. Initial **implementation WIP limit**: at most **1 Work in `Implementing`**
   unless a human explicitly accepts a temporary exception.

The Ready Queue observer applies these criteria independently of executor or
legacy labels. Observation grants no execution or mutation authority. An
authorized handoff selects the executor and must respect Readiness and the
selection constraints. Inside an eligible `Implementing` Work, Task selection
follows the authorized Task plan and Task dependencies.

The implementation WIP limit is an Architecture Web policy, not a generic Method
invariant. Work in `Reviewing` or `Validating` is not counted by this initial
limit unless a future project policy explicitly broadens it.

## 7. Recommended Project views

### Backlog

Table showing at least:

```text
Title
Priority
Labels (including Change Characteristics)
Status (Method Work State)
Work Type
Workflow Depth
Assignees
```

### Ready Queue

Table filtered to:

```text
Status = Ready
```

The view SHOULD expose native Labels for Change Characteristics and MUST keep
membership independent of executor labels. Sort primarily by Priority and then
use dependency/manual ordering as needed.

### Workflow

Board grouped by `Status`, using the ten Method Work State values.

### Active

Show Work whose `Status` is one of:

```text
Preparing
Ready
Implementing
Reviewing
Validating
```

### Waiting

Filter:

```text
Status = Awaiting Approval
```

### Done

Table filtered to:

```text
Status = Done
```

## 8. Pull Requests

A Pull Request is the implementation/review vehicle for repository changes. It
MUST reference the owning Work Issue when applicable and when that operational
mapping is available.

After merge, the Work may still require post-integration validation,
migration or operational work, and synchronization of durable owners before
the Workflow Coordinator can record completion.

Use a non-closing Work reference such as `Refs #205` in the PR. Keep closing
keywords out of the PR and squash commit so that the Work Issue can be closed
after completion evidence is established.

### Native Work integration

Use GitHub's native squash merge for an ordinary Work Integration Pull Request.
[Work #205](https://github.com/Oxelio/architecture-web/issues/205) retires the
custom Work Merge Gate, its check and evidence publication, and the prior
gate-mediated auto-merge and standing-delegation paths. No replacement composite
integration gate or gate-specific evidence bundle is required. Applicable Method
Authority, Readiness, Quality and Evidence Gates still govern their respective
transitions. Record their results in the existing attributable Work, PR and
validation records.

A maintainer with merge authority may perform the squash merge directly or
explicitly authorize an agent to perform it once. An attributable instruction
must identify the Work, PR, exact reviewed and validated head SHA and current
`main` base SHA. Standing delegation and autonomous auto-merge arming are
outside this authorization.

Before integration, verify that:

- the owning Work and its PR are unambiguous and the Work is in `Validating`;
- required in-scope Tasks have acceptable terminal dispositions and dependency
  blockers are resolved;
- applicable independent reviews have been accepted, pre-merge validation
  evidence is sufficient for this candidate, and applicable prior authority
  gates are satisfied;
- no unresolved Working Decision blocks integration or exceeds delegated scope;
- the exact head and base are current and the required checks from their
  configured providers and native mergeability requirements pass.

An authorized agent MUST pass the exact head SHA as the native merge
precondition and reread the base immediately before the request. A changed head
or base voids the authorization. Re-establish current evidence and obtain
explicit authorization for the new candidate before acting. If any prerequisite
is unavailable, GitHub refuses the request, or the result is uncertain, stop and
reconcile the authoritative PR and base state before any further action.
GitHub's strict current-base rule remains mandatory.

### Work Integration Branch and Pull Request

Meaningful repository Work SHOULD use one primary temporary Work Integration Branch and
one Work Integration Pull Request per repository integration target. Ordinary Work branches from `main` and targets `main`.

A Task MAY use its own branch when useful, but its integration target is the Work
Integration Branch. Task-level integration MUST NOT bypass Work-level review,
validation, or merge requirements by merging partial governed Work directly to
`main` or another governed integration target established by accepted policy.

The Work Integration Pull Request MAY remain Draft during `Implementing`.

## 9. Work closure and non-completion dispositions

### Completed Work

The Workflow Coordinator records established completion through authorized
native GitHub Project and Issue operations. Before recording `Done`, verify:

- the exact integrated commit on `main` and its identity as the authorized
  Work candidate, for Work with repository integration;
- the agreed scope is concluded, required Tasks have acceptable terminal
  dispositions, and required dependencies are resolved;
- applicable reviews are accepted, required validation is sufficient, and
  required post-integration obligations are complete;
- required Repository CI and source-release processing succeeded for the
  integrated SHA, including a successful no-release plan when applicable;
- affected durable owners are synchronized and all Working Decisions are
  resolved for the completed scope.

Record attributable evidence in the owning Work or PR. Set Project `Status` to
`Done` and read it back before closing the Work Issue as `completed`. If native
Project automation has already closed the Issue after the authorized transition,
verify that disposition. Otherwise close it as `completed` under the
[operational permission policy](#10-ai-operational-permission-policy) and read
back the Issue state and closure reason. Reconcile partial or uncertain writes
against both live owners before any retry. Escalate conflicting dispositions
without reopening, reclassifying or closing unrelated Work.

### Cancelled / abandoned Work

A Work that is intentionally abandoned, rejected, duplicated, or no longer
planned MUST NOT be marked `Done` merely to make it disappear from active views.

Use GitHub Issue closure reason `not planned` (or `duplicate` where applicable)
as a terminal **disposition orthogonal to lifecycle**. Preserve the last valid
Work State for historical context; the Issue closure reason establishes that no
further execution is planned.

If project views need to distinguish these dispositions more explicitly in the
future, add a dedicated disposition policy rather than extending the Method Work
State list casually.

## 10. AI operational permission policy

Tool Capability, Operational Permission, Role Authority, and Gate requirements
are evaluated independently. An allowed tool mutation never creates the semantic
authority needed to decide the value being recorded. Use authorized native
Project and Issue operations to record lifecycle results. Resolve the Project,
Issue, item, field and current value before a Project write and read back the
result from the operational owner.

The Method `Workflow Coordinator` owns narrow method-level classification and
workflow-recording authority. It may record results established by another
Role/activity, but it does not inherit the upstream authority that created those
results.

For lifecycle fields in particular, the Role or authority responsible for the
underlying activity establishes the semantic result; the Workflow Coordinator
may only record that result after applicable gates are satisfied.

The default Architecture Web policy is:

| Tool operation                                                                                                    | Operational Permission                                                                            | Required Role / authority                                                                                                        | Gate / precondition                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Read repository / Issue / PR / Project                                                                            | Allowed when relevant to current Work                                                             | Any active Role requiring the context                                                                                            | Context scope remains relevant                                                                                                                                                                                                                                           |
| Create a Work Issue                                                                                               | Allowed when an identified Work needs an operational owner                                        | Workflow Coordinator, or another Role explicitly permitted to create only the operational record                                 | Scope is sufficiently established; no upstream truth is invented                                                                                                                                                                                                         |
| Update Work Issue operational context                                                                             | Allowed                                                                                           | Workflow Coordinator, or active Role updating only operational content within its authority                                      | Must not rewrite repository-owned product, architecture, governance, or validation truth                                                                                                                                                                                 |
| Mutate `Work Type`, `Workflow Depth`, or `char:*` classification                                                  | Allowed when the backing owner is activated                                                       | Workflow Coordinator                                                                                                             | Classification result is established under Method rules; uncertainty and reclassification triggers are surfaced                                                                                                                                                          |
| Recommend Priority                                                                                                | No mutation required                                                                              | Any Role with sufficient delivery context                                                                                        | Recommendation is non-authoritative until accepted/applied by delivery authority                                                                                                                                                                                         |
| Mutate `Priority`                                                                                                 | Only with explicit delivery-coordination permission and activated field                           | Human or Workflow Coordinator explicitly delegated delivery-ordering authority                                                   | Dependency and priority policy respected                                                                                                                                                                                                                                 |
| Create Task Sub-issues                                                                                            | Allowed when the mapping is available                                                             | Technical Planner establishes Task boundaries; Workflow Coordinator may record/create the authorized Task units                  | Task Planning is triggered and task boundaries are authorized                                                                                                                                                                                                            |
| Initialize or mutate `Work State` for any Method-valid transition or upstream return other than `Ready` or `Done` | Allowed when the `Status` Work State owner is activated                                           | Workflow Coordinator records the result; the subject-matter Role/activity retains authority for the underlying semantic decision | Method route/transition conditions satisfied; any applicable human, quality, or evidence gate already satisfied. Covers `Idea`, `Exploring`, `Designing`, `Awaiting Approval`, `Preparing`, `Implementing`, `Reviewing`, `Validating`, and Method-valid returns upstream |
| Mutate `Work State` from `Preparing` to `Ready`                                                                   | Allowed when the `Status` Work State owner is activated                                           | Workflow Coordinator records the established Readiness result                                                                    | Valid `READY` or `READY WITH RISKS` result exists; prior authority gates satisfied                                                                                                                                                                                       |
| Create branch                                                                                                     | Allowed for authorized implementation/governance scope                                            | Active Role authorized to modify that scope                                                                                      | Applicable upstream authority/gates satisfied                                                                                                                                                                                                                            |
| Rewrite or replace `main` / `development` Git refs                                                                | Not granted by default                                                                            | Explicit human governance authority                                                                                              | Material Governance Change accepted; preservation, rollback, and validation plan established                                                                                                                                                                             |
| Modify repository code/docs                                                                                       | Allowed only for authorized scope                                                                 | Active Role owns the relevant implementation/design/governance activity                                                          | Must preserve upstream owners and applicable gates                                                                                                                                                                                                                       |
| Create or update PR                                                                                               | Allowed for authorized scope                                                                      | Active Role proposing the repository change; Workflow Coordinator may maintain operational PR metadata                           | PR must not be treated as approval or merge authority                                                                                                                                                                                                                    |
| Write Code / Architecture / Functional review output                                                              | Allowed                                                                                           | Corresponding review Role with refreshed context                                                                                 | Applicable review context resolved                                                                                                                                                                                                                                       |
| Mutate `Work State` to `Done` / close completed Work                                                              | Allowed only to record an established completion result and when the backing owners are activated | Workflow Coordinator records closure; it MUST NOT manufacture missing review/validation acceptance                               | Done invariants, applicable Quality Gate, and Evidence Gate satisfied                                                                                                                                                                                                    |
| Close Work as `not planned` / `duplicate`                                                                         | Not granted to AI by default                                                                      | Human or Workflow Coordinator explicitly delegated delivery-disposition authority                                                | Must preserve last valid Work State; disposition is not `Done`                                                                                                                                                                                                           |
| Merge a Work Integration PR                                                                                       | Allowed only for an individually authorized native squash merge                                   | Maintainer with merge authority, or agent explicitly authorized by that maintainer for the exact Work, PR, head and base         | Verify the prerequisites and enforce the preconditions in [Native Work integration](#native-work-integration)                                                                                                                                                            |

Entering `Awaiting Approval` records that an external authority decision is
pending; it does not execute that authority gate. Leaving `Awaiting Approval`
may be recorded only after the required decision actually exists and the Method
permits the resulting transition.

Human-only approvals are **Authority Gates**, not tool operations. No Operational
Permission can authorize an AI to execute Human Functional Approval or any other
project-defined human-only gate. When project policy permits, the Workflow
Coordinator may record the result of a human decision only after that decision
actually exists.

Likewise, performing Code, Architecture, or Functional Compliance Review is a
Role activity rather than a tool permission. The matrix governs the mutation
used to record review output; the corresponding review Role governs the semantic
review decision.

Orchestration is coordination across these permissions and Roles, not a
new authority super-role. A material change of Activity or Role SHOULD be made
explicit and SHOULD trigger focused context re-resolution.

## 11. GitHub automation constraints

Automation MAY reduce mechanical coordination, but it MUST preserve semantic
gates.

Safe candidates include:

- populating non-authoritative display fields;
- surfacing linked PRs or Sub-issue progress;
- creating filtered views;
- notifying about blocked or stale Work.

Automation MUST NOT blindly:

- assign or transition lifecycle `Status` merely because an item is added, an
  Issue is closed, or a Pull Request is merged;
- infer an absent `Status` as `Idea` or another Work State;
- mark a Work `Ready` without Readiness;
- mark a Work `Done` when a PR merges;
- execute human-only approvals;
- change Priority as a substitute for delivery authority;
- let an executor take unrelated Work, broaden its scope, or substitute an
  executor outside the authorized handoff;
- accept a target ref solely from untrusted agent output;
- treat required check or automatic publication success as merge authority.

## 12. Agent execution security and delivery tooling

Ordinary agent execution MUST NOT receive credentials granting privileged
repository, Project, merge, release, or governance mutations beyond the
operations explicitly delegated to that execution scope.

Use established, least-privilege access for each GitHub operation. Direct
Project and Issue writes use the authority, prerequisites and read-back
requirements in section 10. An agent's native squash merge is subject to the
candidate-specific restrictions in section 8. Retained privileged automation
must use a trusted, separated publisher or an equivalent boundary that validates
the operation, enforces least privilege, preserves auditability and refuses
unauthorized mutations.

Workspace write access within authorized implementation scope does not by itself
grant GitHub platform mutation authority. Governance, agent-control, CI/CD,
credential, and other protected project files MUST NOT be modified by ordinary
feature execution unless the authorized Work explicitly includes them and
applicable policy permits it.

Delivery tooling deterministically applies the established Ready Queue,
dependency, WIP, target-ref and release publication rules at their respective
boundaries. Ready Queue observation is read-only. Human-directed Task selection
follows the authorized Task plan and Task dependencies. Legacy autonomous
dispatch and claim paths MUST fail closed while their required mappings are
inactive.

Workflow and agent tooling may act on results already established by the
responsible Role or authority. Work State, review acceptance, approvals,
validation sufficiency and Priority come from their designated owners.

A workflow must verify an explicit authorized target ref for operations that
require one. The workflow's own ref and untrusted agent output cannot establish
the authorized target.

Exact runtime, secret storage, token issuance, model, reasoning effort, sandbox,
workflow syntax, and publisher implementation belong to Technical Design.

## 13. Automatic coordinated source releases

### Authority and ownership

The maintainer accepted automatic routine releases in Work #58 on 2026-10-29.
GitHub Releases and attached manifests own release identity and publication
traceability after separate activation verification. No per-release Release Work
Issue, beta deployment, environment approval or Human Release Approval is
required. The former Release Promotion Gate and staged promotion route are
superseded. Normal development Issues and their Work/Task governance remain.

The first `1.0.0` is the sole release-specific human decision: a human maintainer
with current maintain/admin authority explicitly requests it through the release
workflow on `main`, identifying the exact expected SHA. Bots, generic commit
markers, merge capability and automatic breaking-change analysis do not supply
this decision. The originating human dispatch is retained in release metadata;
validation and publication then proceed automatically.

### Version policy

Use one coordinated project version and `vX.Y.Z` tags. Published tags own release
versions. Tracked manifests are development declarations; generated source
archives stamp all discovered workspace manifests and preserve `workspace:*`.
The accepted initial migration is `1.0.0-alpha.1` to `0.1.0`, with no implied tag
or publication. Do not normalize other prerelease bases without an explicit
migration decision. No independent package or npm registry publishing is active.

Analyze all commits since the preceding release tag through the selected SHA and
apply the maximum impact once:

| Commit                                 | Before 1.0.0 | From 1.0.0 onward |
| -------------------------------------- | ------------ | ----------------- |
| `fix:`                                 | PATCH        | PATCH             |
| `feat:`                                | MINOR        | MINOR             |
| `!` or `BREAKING CHANGE`               | MINOR        | MAJOR             |
| Other types without breaking semantics | No release   | No release        |

Without a prior tag, releasing history bootstraps to `0.1.0`. Non-releasing
history alone does not create a release. Automatic analysis cannot produce the
first `1.0.0`; only the explicit first-stable request can do so. Alpha/beta/rc
suffixes are not used in V1. HTTP contract versions remain independent of project
SemVer; release automation must preserve existing `/v1` URLs.

### Candidate validation and automatic publication

A push to `main` triggers version planning against an immutable selected main
SHA. PRs, temporary branches and tags cannot trigger publication. A no-release
plan or already-published candidate causes no publication mutation. A candidate
must pass build, application/test typechecks, lint, tests, formatting, documentation
links and whitespace checks before artifact generation and publication.

These automated checks are sufficient release-boundary evidence under this
accepted policy. Pre-merge Work validation may also rely on sufficient automated
candidate-bound evidence under [Testing and verification](../development/testing.md);
applicable reviews and authority decisions remain independent of release publication.

Generate a deterministic versioned source archive, notes, source/version manifest
and SHA256 checksums. Include the pinned Method sources. These are source
artifacts, not executable distributions or deployment evidence. Raw GitHub source
archives retain the original tracked development declarations.

The privileged publisher must revalidate the source, version plan, first-stable
request when applicable, checksums and remote identities. Create the tag on the
validated source commit, then publish the GitHub Release. Never create a release
commit, push a branch, merge a PR or mutate Work Issues as a publication effect.

### Permissions, concurrency and recovery

Validation/generation jobs use read credentials. A separate publisher uses only
the repository permissions needed for tags and Releases, plus read access to its
workflow/authorization evidence. Run trusted control code; do not execute
candidate lifecycle scripts with publication credentials. Respect actual platform
protections and report unavailable enforcement rather than bypassing it.

Serialize publication. Complete a tagged missing/draft release before selecting
a newer candidate. Preserve immutable plan metadata in the annotated tag so
reruns can reproduce artifacts. Identical tags/assets are reused; differing
source targets, metadata or asset bytes block publication. Do not move/delete
tags or overwrite assets. A failed validation produces no tag or Release.

The [release guide](../development/releases.md) owns operational commands and
recovery instructions; [ADR-0008](../architecture/decisions/0008-main-only-automatic-releases.md)
owns structural rationale. Hosting, deployment and environments require separate
accepted scope and activation; they are not prerequisites for source releases.

## 14. Runtime neutrality and activation

Durable delivery governance MUST remain independent from a specific agent runtime
or AI model. Runtime implementation MAY change without redefining Work State,
Method Roles, native integration authority, human-directed execution policy, or
release authority.

External mappings/enforcement become effective only after separate implementation
and verification. This includes, where applicable:

- native `Status` Work State mapping and its lifecycle-safe Project settings;
- Task dependency mappings;
- native repository rulesets and required checks;
- GitHub Release / release-manifest operational mapping;
- `alpha`, `beta`, and `production` environment configuration;
- first-stable human dispatch recording;
- automatic release publication enforcement;
- least-privilege Project access and release publisher credentials;
- runtime adapters explicitly authorized for activation.

The [activation manifest](../../.github/delivery-automation.json) retains inactive
`routes` and `taskClaim` entries in schema version 1. Inventory and activation
verification do not require their primitives while inactive. Verification of live
configuration preserves inactive entries. Activating a mapping requires a
separate, authorized change and verification. Verify live operational compatibility
after integrating the retirement.

Until each mechanism is verified, tooling MUST treat it as unavailable rather
than inventing a parallel substitute owner or enforcement path.

## 15. Architecture Web delivery expectations

For meaningful Architecture Web work:

- resolve the relevant canonical project owners through the Project Method
  Profile;
- classify the Work and select proportional Workflow Depth;
- preserve the separation between product behavior and technical design;
- obtain Human Functional Approval before new/changed product behavior becomes
  `Approved`;
- evaluate project architecture constraints during Technical Design and
  Architecture Review when applicable;
- create ADRs only when the generic ADR trigger applies;
- create focused Tasks before formal Readiness Review when Task Planning is
  triggered;
- do not enter `Ready` while an unresolved decision exceeds Developer authority;
- perform applicable Code, Architecture, and Functional Compliance Review;
- validate at the smallest sufficient evidence boundaries defined by the
  project testing policy;
- synchronize current architecture/documentation owners only when the truth they
  describe becomes effective;
- do not treat an external operational owner as effective before its activation
  requirements have been verified.

## 16. Architecture Web architecture criteria

When architecture is affected, use these canonical project owners:

- [Architecture principles](architecture-principles.md);
- [Architecture overview](../architecture/overview.md);
- [Dependency rules](../architecture/dependency-rules.md);
- [Packages and public APIs](../architecture/packages.md);
- [ADRs](../architecture/decisions/README.md).

Do not infer a preferred pattern from a historical implementation exception.
Implementation evidence may reveal drift but does not silently replace canonical
architecture constraints.

## 17. Validation bindings

Architecture Web's concrete validation strategy and commands are owned by
[Testing and verification](../development/testing.md). Work should use only the
checks necessary for its type, depth, characteristics, and affected boundaries.

## 18. Common Architecture Web routes

These examples apply the generic method; they are not separate lifecycles.

### Small established defect

```text
Defect Correction / Quick
-> lightweight work scope/readiness check
-> Implementation
-> Code Review + Functional Compliance when applicable
-> targeted Validation
-> Done
```

### Product behavior change

```text
Product Behavior Change / Standard or Complex
-> Exploration when required
-> Functional Specification
-> Human Functional Approval
-> Technical Design when triggered
-> Task Planning when triggered
-> Readiness Review
-> Implementation
-> applicable Reviews
-> Validation
-> Done
```

### Cross-cutting architecture change

```text
Architecture Change / usually Complex
-> Exploration
-> Architecture design / decision analysis
-> human structural decision when required
-> ADR when triggered
-> implementation-oriented design + Tasks when triggered
-> Readiness Review
-> Implementation
-> Architecture Review
-> Validation
-> Done
```

No Functional Specification is manufactured for a pure architecture change with
no intended product behavior change.

### Research / POC

```text
Research / Discovery
-> Exploration / spike / POC
-> evidence and conclusion
-> integrate accepted conclusion into the appropriate owner if needed
-> Done
```

POC code is not production architecture merely because it exists.

## 19. Legacy artifact metadata

Existing process documents use a `Lifecycle` metadata field created before Work
State and artifact maturity were explicitly separated. For those documents,
values such as `Design`, `Approved`, `Implementation`, `Review`, or `Validation`
should be interpreted as **artifact/work-scope maturity metadata**, not as a
claim that these words are generic Work States in the new method.

New workflow reasoning should use the Work States defined by the generic
[Lifecycle](../../external/software-engineering-method/lifecycle.md). A separate migration of legacy metadata may
be performed later when it provides enough value to justify repository churn.
