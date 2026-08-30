# Architecture Web — Delivery profile

> **Content status:** Canonical
>
> **Document type:** Project Governance
>
> **Domain:** Delivery / Architecture

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
Execution route/provider         -> GitHub Issue label: agent:*
Human identity assignment         -> GitHub native assignees
Work dependency/blocker relation -> GitHub native relationship when represented;
                                   otherwise Work Issue operational context
Work closure disposition         -> GitHub Issue state / state reason
Task identity                    -> GitHub Sub-issue
Task parent relationship         -> GitHub native Sub-issue relationship
Task execution context           -> Task Sub-issue
Task completion                  -> GitHub Sub-issue open/closed state
Release candidate/promotion      -> top-level GitHub Issue representing Release Work
Delivery ordering                -> GitHub Project
Implementation/review vehicle    -> Pull Request
```

The Work Issue owns only the operational objective and execution scope needed to
coordinate the Method Work. It MUST NOT become the owner of product behavior,
functional scope, architecture decisions, governance policy, or validation truth
that is assigned to another canonical owner.

### Repository branch policy

Architecture Web uses `main` as the repository's default reference branch and
`development` as its integration branch.

The repository branch topology MUST preserve shared Git ancestry between these
branches:

- `development` MUST descend from `main`;
- ordinary implementation and governance work SHOULD be performed on dedicated
  Work branches created from `development`;
- completed ordinary Work branches SHOULD be integrated into `development`
  through a Work Integration Pull Request;
- the normal beta/stable release path MUST use a short-lived `release/*`
  candidate branch rather than treating direct `development -> main` promotion
  as the ordinary release path;
- release-candidate correction Work SHOULD target the authorized `release/*`
  branch and MUST be reconciled into `development` no later than release
  completion when the correction must survive the release;
- stable promotion from `release/*` to `main` MUST use the Release Promotion
  Gate and the repository's authorized merge process;
- after stable promotion, `main` MUST be synchronized back into `development`
  before ordinary integration continues when needed to restore the shared
  ancestry invariant;
- `main` and `development` MUST NOT be rewritten, replaced, or recreated in a
  way that breaks their shared ancestry as an ordinary implementation action.

Any intentionally supported direct-promotion or emergency path MUST be defined
explicitly and MUST NOT silently bypass the Release Promotion Gate.

A force update, history rewrite, branch replacement, or other operation that
can materially alter the shared history of `main` or `development` is a
**Material Governance Change**. It requires explicit human authorization before
execution and MUST include sufficient preservation, rollback, and validation
measures for the affected history.

Tool capability to create, update, delete, or force-update a Git ref does not
grant authority to perform such an operation.

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
execution-claim mechanisms, required checks, environments, and privileged
publisher credentials therefore requires separate delivery/governance
implementation and verification. That step MUST verify at least the configured
field names and values, applicable labels/relationships, the native `Status`
Work State mapping, routing visibility, execution-claim semantics, required
checks, and the intended Project views before an external owner or enforcement
mechanism is treated as effective. Project lifecycle settings that cannot be
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

### Execution routing and Task execution

`agent:*` is the project namespace for execution-route/provider assignment once
that label mapping is activated. It owns only the selected execution route for
the executable Work or Task.

The namespace MUST NOT encode a concrete model, Method Role, runtime framework,
or approval/authority gate. Tokens such as `agent:human`, `agent:codex`,
`agent:claude-code`, or `agent:gemini` name contractual execution routes; for
example, `agent:codex` does not freeze a model version, runtime framework,
credential mechanism, inference provider, or scheduling mechanism.

An executable Work or Task MUST have at most one active `agent:*` route:

```text
0 agent:*   -> unassigned route
1 agent:*   -> assigned route
>1 agent:*  -> conflicting route; execution blocked
```

A missing route MUST NOT invalidate an otherwise valid Work State and MUST NOT
become a hidden Readiness Gate. `agent:human` means human execution only; it does
not represent human approval or authority.

An automated execution agent MUST NOT assign, remove, or change its own route.
A route mutation requires explicit human delivery assignment or an explicit
project delegation granting the Workflow Coordinator authority to establish or
record that route. Tool capability to edit labels does not create routing
authority.

Method Role remains independent from the physical executor. The active Role is
resolved from Activity and Context; a material Activity/Role change SHOULD
trigger focused context re-resolution.

A lightweight Work without implementation Tasks MAY itself be executable. When
implementation Tasks exist, those Tasks are the executable units and MUST NOT
implicitly inherit the parent Work's `agent:*` route in V1. Semantic Task order
MUST use the activated dependency mechanism; non-semantic tie-breaks MAY be
implementation-defined but MUST be deterministic. Task closure alone does not
prove successful completion when its disposition does not satisfy the authorized
Task plan.

#### V1 Task execution concurrency

V1 MUST serialize all active implementation Task execution within one Work,
regardless of human or automated execution. At most one implementation Task may
hold the Work's active Task execution claim at a time.

A human or automated executor MUST establish that claim before beginning Task
execution and MUST release or resolve it when execution ends, is handed off, or
reaches an accepted terminal disposition.

The Workflow Coordinator MUST NOT dispatch an automated Task while another Task
for the same Work has an active claim, including a human-executed Task. A human
MUST NOT begin a second Task while another claim is active unless a human with
explicit project delivery/governance authority authorizes a bounded exception.

The exact GitHub field, relationship, lock, lease, heartbeat, timeout, recovery,
or other claim mechanism belongs to downstream activation/Technical Design.
Until that mechanism is implemented and verified, automated dispatch MUST treat
a mixed human/automated Work as unavailable when it cannot reliably establish
that no human Task is active.

This constraint does not create a Task-level Method Work State.

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
Execution route (`agent:*`)
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
3. For an automated executor, retain only Work whose activated `agent:*` route
   matches that executor. A Work routed elsewhere remains valid Ready Work but
   is not a candidate for the current executor.
4. Among the remaining executor-compatible Work, lower Priority number wins
   (`P0` before `P1`, etc.).
5. At equivalent dependency and Priority conditions, explicit manual ordering,
   age, or another implementation-defined deterministic tie-break MAY decide.
6. Initial **implementation WIP limit**: at most **1 Work in `Implementing`**
   unless a human explicitly accepts a temporary exception.

`agent:*` therefore filters dispatch candidates only after lifecycle, dependency,
and WIP eligibility. It does not redefine Ready Queue membership or Priority.
The same separation applies to Task dispatch inside an eligible `Implementing`
Work.

The implementation WIP limit is an Architecture Web policy, not a generic Method
invariant. Work in `Reviewing` or `Validating` is not counted by this initial
limit unless a future project policy explicitly broadens it.

## 7. Recommended Project views

### Backlog

Table showing at least:

```text
Title
Priority
Execution route (`agent:*`)
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

The view SHOULD expose `agent:*` routing when that mapping is activated so human
and automated coordinators can distinguish executor-compatible candidates without
redefining Ready Queue membership. Sort primarily by Priority and then use
dependency/manual ordering as needed.

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

A merged PR does not by itself imply `Done`. After merge, the Work may still
require review resolution, validation acceptance, migration/operational work,
or synchronization of durable owners.

Automatic merge authority is not granted by this delivery policy. Merge remains
subject to repository/project permissions and any explicitly established human
or AI authority policy.

### Work Integration Branch and Pull Request

Meaningful repository Work SHOULD use one primary Work Integration Branch and
one Work Integration Pull Request per repository integration target. Ordinary
Work normally branches from `development`; release-candidate correction Work may
target an authorized `release/*` branch.

A Task MAY use its own branch when useful, but its integration target is the Work
Integration Branch. Task-level integration MUST NOT bypass Work-level review,
validation, or merge requirements by merging partial governed Work directly to
`development` or another governed integration target.

The Work Integration Pull Request MAY remain Draft during `Implementing`.

### Work Merge Gate

A Work Integration Pull Request MUST NOT merge into its governed integration
target until the Work Merge Gate passes. In V1, that gate is evaluated only
while the owning Work is in `Validating`.

The Work Merge Gate is composite enforcement over results already established by
their proper Roles/Authorities. It MUST NOT manufacture review acceptance,
validation sufficiency, human approval, Priority, or merge authority.

It may pass only when:

- the owning Work is identifiable and its Method Work State is `Validating`
  (`Status = Validating`);
- required in-scope Tasks have acceptable terminal dispositions;
- required dependency blockers are resolved;
- applicable review results have already been accepted;
- required pre-merge validation evidence is sufficient;
- applicable prior authority gates are satisfied;
- no unresolved Working Decision invalidates integration or exceeds delegated
  implementation authority;
- repository-required checks and mergeability requirements pass.

A passing Work Merge Gate does not grant automatic merge authority and does not
imply `Done`. Post-merge synchronization or validation evidence may remain.

The Work Merge Gate governs ordinary Work Integration Pull Requests and
release-candidate correction Work targeting `release/*`. It does **not** govern
the Release Work's `release/* -> main` promotion Pull Request, which is protected
by the distinct Release Promotion Gate.

## 9. Work closure and non-completion dispositions

### Completed Work

Closing a Work Issue as completed SHOULD be the consequence of Method Work State
`Done` (`Status = Done`), not a replacement for the Done invariants.

Before moving to `Done` and closing as completed, verify:

- agreed scope is concluded;
- applicable reviews are sufficiently accepted;
- required validation evidence is sufficient;
- affected durable owners are synchronized with the truth they own;
- no unresolved Working Decision remains for the completed scope.

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
authority needed to decide the value being recorded.

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
| Initialize or mutate `Work State` for any Method-valid transition or upstream return other than `Ready` or `Done` | Allowed when the `Status` Work State owner is activated                                            | Workflow Coordinator records the result; the subject-matter Role/activity retains authority for the underlying semantic decision | Method route/transition conditions satisfied; any applicable human, quality, or evidence gate already satisfied. Covers `Idea`, `Exploring`, `Designing`, `Awaiting Approval`, `Preparing`, `Implementing`, `Reviewing`, `Validating`, and Method-valid returns upstream |
| Mutate `Work State` from `Preparing` to `Ready`                                                                   | Allowed when the `Status` Work State owner is activated                                            | Workflow Coordinator records the established Readiness result                                                                    | Valid `READY` or `READY WITH RISKS` result exists; prior authority gates satisfied                                                                                                                                                                                       |
| Create branch                                                                                                     | Allowed for authorized implementation/governance scope                                            | Active Role authorized to modify that scope                                                                                      | Applicable upstream authority/gates satisfied                                                                                                                                                                                                                            |
| Rewrite or replace `main` / `development` Git refs                                                                | Not granted by default                                                                            | Explicit human governance authority                                                                                              | Material Governance Change accepted; preservation, rollback, and validation plan established                                                                                                                                                                             |
| Modify repository code/docs                                                                                       | Allowed only for authorized scope                                                                 | Active Role owns the relevant implementation/design/governance activity                                                          | Must preserve upstream owners and applicable gates                                                                                                                                                                                                                       |
| Create or update PR                                                                                               | Allowed for authorized scope                                                                      | Active Role proposing the repository change; Workflow Coordinator may maintain operational PR metadata                           | PR must not be treated as approval or merge authority                                                                                                                                                                                                                    |
| Write Code / Architecture / Functional review output                                                              | Allowed                                                                                           | Corresponding review Role with refreshed context                                                                                 | Applicable review context resolved                                                                                                                                                                                                                                       |
| Mutate `Work State` to `Done` / close completed Work                                                              | Allowed only to record an established completion result and when the backing owners are activated | Workflow Coordinator records closure; it MUST NOT manufacture missing review/validation acceptance                               | Done invariants, applicable Quality Gate, and Evidence Gate satisfied                                                                                                                                                                                                    |
| Close Work as `not planned` / `duplicate`                                                                         | Not granted to AI by default                                                                      | Human or Workflow Coordinator explicitly delegated delivery-disposition authority                                                | Must preserve last valid Work State; disposition is not `Done`                                                                                                                                                                                                           |
| Merge PR                                                                                                          | Not granted by this policy                                                                        | Separate project/repository merge authority required                                                                             | Applicable project/repository merge requirements satisfied                                                                                                                                                                                                               |

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
- let an execution agent self-assign or silently substitute its `agent:*` route;
- assume a mixed human/automated Work is idle when Task activity cannot be
  reliably established;
- accept a target ref solely from untrusted agent output;
- treat Work Merge Gate or Release Promotion Gate success as automatic merge
  authority.

## 12. Agent execution security and deterministic control plane

Ordinary agent execution MUST NOT receive credentials granting privileged
repository, Project, merge, release, or governance mutations beyond the
operations explicitly delegated to that execution scope.

Privileged GitHub writes MUST pass through a trusted publisher, safe-output
mechanism, or equivalent separated component that validates the requested
operation, enforces least privilege and protected-file restrictions, preserves
auditability, and refuses unauthorized owner/gate mutations.

Workspace write access within authorized implementation scope does not by itself
grant GitHub platform mutation authority. Governance, agent-control, CI/CD,
credential, and other protected project files MUST NOT be modified by ordinary
feature execution unless the authorized Work explicitly includes them and
applicable policy permits it.

The delivery control plane MUST deterministically apply established policy for
Work/Task dispatch eligibility, dependencies, WIP, routing validation, target-ref
validation, lifecycle-transition validity, Work Merge Gate evaluation, and
Release Promotion Gate prerequisites.

The control plane MAY record or act on semantic results established by the Role
or Authority responsible for the underlying Activity. It MUST NOT manufacture
review acceptance, functional approval, architecture authority, validation
sufficiency, Priority, release approval, or another semantic result merely from
agent confidence, prose, or tool capability.

The branch owning a scheduled workflow does not own application branch semantics.
The control plane MUST select or validate an explicit authorized target ref before
dispatch, and MUST NOT accept the target ref solely from untrusted agent output.
A stable default-branch control plane may therefore coordinate authorized Work on
`development`, `release/*`, or another explicitly permitted target without
creating a permanent branch solely for scheduling.

Exact runtime, secret storage, token issuance, model, reasoning effort, sandbox,
workflow syntax, and publisher implementation belong to Technical Design.

## 13. Release governance

Branches and deployment environments are distinct delivery concepts. The normal
staged topology is:

```text
branches:      development    release/*    main
environments:  alpha          beta         production
promotion:     development -> alpha
               release/*   -> beta
               main        -> production
```

A permanent `staging` branch SHOULD NOT be introduced solely to represent the
beta environment. Release branches MUST remain short-lived.

### Release Work

A staged release MUST have one identifiable Release Work as its operational
coordination owner. Release Work is a normal Method Work, not a new Work Type.
For a pure operational promotion preserving already-authorized behavior,
`Technical Change` with the `operational` Change Characteristic is the expected
classification; Workflow Depth remains risk-based.

The Release Work SHOULD reference the release branch/ref, candidate commit/ref,
artifact identity when applicable, included Work/release scope, beta validation
evidence, Human Release Approval result, and production promotion/deployment
evidence. These are operational references only; Release Work MUST NOT duplicate
or replace product, architecture, implementation, or validation truth.

Release-candidate corrections SHOULD use authorized Work/Task branches targeting
the release branch. Corrections that must survive the release MUST be reconciled
into `development` no later than release completion.

### V1 Release Work route

```text
Idea
-> Preparing            release scope/candidate plan, Tasks when needed, Readiness
-> Ready
-> Implementing         create candidate, build artifact, deploy beta
-> Validating           collect/evaluate beta evidence
-> Awaiting Approval    Human Release Approval
-> Implementing         promote approved candidate to main/production and synchronize
-> Validating           production/promotion/synchronization evidence
-> Done
```

If beta validation fails or the candidate changes materially, the Work returns
to the activity/state authorized to correct it, then repeats applicable
validation and Human Release Approval. The post-approval transition may return
directly to `Implementing` because promotion scope was prepared before initial
Readiness; if approval or a discovered change introduces new scope, design, risk,
or execution decisions, normal upstream return and Readiness rules apply.

### Candidate identity and artifact promotion

The release process SHOULD preserve the identity of the candidate that received
beta validation and Human Release Approval. Promoting the same immutable artifact
from beta to production is preferred.

If Technical Design requires a rebuild, it MUST define immutable source identity,
the reproducibility/equivalence guarantee, and validation evidence sufficient to
treat the rebuilt artifact as the approved candidate. A rebuild MUST NOT silently
substitute a materially different artifact. A material candidate source or
artifact change after approval invalidates the previous Human Release Approval.

### Human Release Authority and Human Release Approval

V1 defines **Human Release Approval** as a project-specific human-only Authority
Gate for stable release promotion.

For V1, Human Release Authority is held by a **human Architecture Web maintainer
explicitly acting as Human Release Authority for the identified candidate**.
Repository maintainer status is the eligibility basis chosen by project
governance; GitHub write, merge, review, environment, or deployment capability
does not by itself prove that Human Release Approval was exercised.

The approval decision MUST be explicit and candidate-specific. Delegating the
technical act of merge or deployment does not delegate Human Release Authority
unless a later accepted governance rule explicitly defines such delegation.

Human Release Approval:

- applies to one identified release candidate;
- requires sufficient beta validation evidence;
- authorizes promotion of that candidate toward `main` and production;
- does not itself merge a Pull Request or execute deployment;
- MUST be renewed if the approved candidate changes materially.

AI MAY prepare evidence, assess readiness, recommend approval, and record an
already-existing human decision when project policy permits. AI MUST NOT execute
Human Release Approval.

The approval record MUST be attributable to a human Architecture Web maintainer
explicitly acting as Human Release Authority, identify the Release Work and
approved candidate source/ref, and identify the candidate artifact when artifact
identity is part of the release guarantee. Generic or stale approval MUST NOT
satisfy the gate.

The concrete GitHub recording/enforcement mechanism belongs to activation or
Technical Design and does not change the semantic authority owner.

### Release Promotion Gate

The Release Promotion Gate is distinct from the Work Merge Gate and protects the
normal `release/* -> main` promotion. It may pass only when:

- the Release Work and candidate are identifiable;
- required beta evidence is sufficient;
- Human Release Approval exists for the current candidate;
- applicable repository checks/protections pass;
- no release blocker or unresolved out-of-authority Working Decision remains.

A PR review, environment approval, deployment status, or platform protection MAY
record or enforce parts of this contract, but platform capability does not become
semantic release authority. The promotion Pull Request MUST reference its Release
Work. Passing the Release Promotion Gate does not grant automatic merge authority
unless a separate accepted project policy explicitly grants it.

After stable promotion, `main` MUST be synchronized back into `development` when
needed before ordinary integration continues so the shared-ancestry invariant is
restored.

## 14. Runtime neutrality and activation

Durable delivery governance MUST remain independent from a specific agent runtime
or AI model. Runtime implementation MAY change without redefining `agent:*`,
Work State, Method Roles, Work Merge Gate semantics, Task concurrency, or release
authority.

External mappings/enforcement become effective only after separate implementation
and verification. This includes, where applicable:

- native `Status` Work State mapping and its lifecycle-safe Project settings;
- `agent:*` label inventory and route mapping;
- Task dependency mappings;
- active Task execution-claim mechanism;
- routing visibility/filtering in Project views;
- Work Merge Gate required checks/rulesets;
- Release Work operational mapping;
- `alpha`, `beta`, and `production` environment configuration;
- Human Release Approval recording;
- Release Promotion Gate enforcement;
- privileged publisher / Project credentials;
- selected runtime adapters.

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
