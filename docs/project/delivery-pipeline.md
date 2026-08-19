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
Work State                       -> GitHub Project field: Work State
Work Type                        -> GitHub Project field: Work Type
Workflow Depth                   -> GitHub Project field: Workflow Depth
Priority                         -> GitHub Project field: Priority
Change Characteristics           -> GitHub Issue labels: char:*
Execution assignee               -> GitHub native assignees
Work dependency/blocker relation -> GitHub native relationship when represented;
                                   otherwise Work Issue operational context
Work closure disposition         -> GitHub Issue state / state reason
Task identity                    -> GitHub Sub-issue
Task parent relationship         -> GitHub native Sub-issue relationship
Task execution context           -> Task Sub-issue
Task completion                  -> GitHub Sub-issue open/closed state
Delivery ordering                -> GitHub Project
Implementation/review vehicle    -> Pull Request
```

The Work Issue owns only the operational objective and execution scope needed to
coordinate the Method Work. It MUST NOT become the owner of product behavior,
functional scope, architecture decisions, governance policy, or validation truth
that is assigned to another canonical owner.

### External-owner activation

An external ownership assignment in this profile is effective Current Truth only
when the backing GitHub primitive exists, is usable for the assigned subject, and
has been verified against this policy. Merging this document does not by itself
make a missing or unverified external owner operational.

Until an assignment is activated, this profile owns the accepted/project target
mapping for that subject, while the effective operational owner MUST be treated
as unavailable rather than inferred or replaced by chat history, PR text, or a
parallel ad hoc field.

Initial activation of the Project-backed fields, labels, views, and relationships
therefore requires a separate delivery/governance implementation and verification
step. That step MUST verify at least the configured field names and values,
applicable labels/relationships, native `Status` treatment, and the intended
Project views before the external owner is treated as effective.

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

## 4. Work State

Once effectively activated, the GitHub Project field `Work State` is Architecture
Web's unique operational owner of the Method Work State.

Allowed values are exactly:

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

A Work State mutation is permitted only when the Method transition rule and all
applicable gates are satisfied. Project tooling MUST NOT move Work merely
because an API operation is available.

The policy applies to both forward transitions and Method-valid returns to an
upstream state. Returning upstream after a later finding is normal lifecycle
behavior and MUST be recorded when the responsible Role/activity has established
that return.

### Native GitHub `Status`

GitHub's native `Status` field is **not** a lifecycle owner for Architecture Web.
If the field cannot be removed, it SHOULD be hidden from operational views and
MUST NOT be maintained as a parallel `Todo / In progress / Done` lifecycle.

Automations MUST NOT infer or mutate `Work State` from native `Status`.

## 5. Classification and delivery fields

Once their assignments are effectively activated, the Project SHOULD expose:

```text
Title
Assignees
Work State
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

1. Only Work whose `Work State = Ready` is eligible for the Ready Queue.
2. Available execution capacity pulls the next eligible Work.
3. Dependencies override normal Priority ordering when they make a Work
   non-executable or require another Work to complete first.
4. Among otherwise eligible Work, lower Priority number wins (`P0` before
   `P1`, etc.).
5. At equivalent dependency and Priority conditions, explicit manual ordering
   or age MAY break ties.
6. Initial **implementation WIP limit**: at most **1 Work in `Implementing`**
   unless a human explicitly accepts a temporary exception.

The implementation WIP limit is an Architecture Web policy, not a generic Method
invariant. Work in `Reviewing` or `Validating` is not counted by this initial
limit unless a future project policy explicitly broadens it.

## 7. Recommended Project views

### Backlog

Table showing at least:

```text
Title
Priority
Work State
Work Type
Workflow Depth
Assignees
```

### Ready Queue

Table filtered to:

```text
Work State = Ready
```

Sort primarily by Priority and then use dependency/manual ordering as needed.

### Workflow

Board grouped by `Work State`, using the ten Method values.

### Active

Show Work in:

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
Work State = Awaiting Approval
```

### Done

Table filtered to:

```text
Work State = Done
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

## 9. Work closure and non-completion dispositions

### Completed Work

Closing a Work Issue as completed SHOULD be the consequence of `Work State =
Done`, not a replacement for the Done invariants.

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

| Tool operation | Operational Permission | Required Role / authority | Gate / precondition |
| --- | --- | --- | --- |
| Read repository / Issue / PR / Project | Allowed when relevant to current Work | Any active Role requiring the context | Context scope remains relevant |
| Create a Work Issue | Allowed when an identified Work needs an operational owner | Workflow Coordinator, or another Role explicitly permitted to create only the operational record | Scope is sufficiently established; no upstream truth is invented |
| Update Work Issue operational context | Allowed | Workflow Coordinator, or active Role updating only operational content within its authority | Must not rewrite repository-owned product, architecture, governance, or validation truth |
| Mutate `Work Type`, `Workflow Depth`, or `char:*` classification | Allowed when the backing owner is activated | Workflow Coordinator | Classification result is established under Method rules; uncertainty and reclassification triggers are surfaced |
| Recommend Priority | No mutation required | Any Role with sufficient delivery context | Recommendation is non-authoritative until accepted/applied by delivery authority |
| Mutate `Priority` | Only with explicit delivery-coordination permission and activated field | Human or Workflow Coordinator explicitly delegated delivery-ordering authority | Dependency and priority policy respected |
| Create Task Sub-issues | Allowed when the mapping is available | Technical Planner establishes Task boundaries; Workflow Coordinator may record/create the authorized Task units | Task Planning is triggered and task boundaries are authorized |
| Initialize or mutate `Work State` for any Method-valid transition or upstream return other than `Ready` or `Done` | Allowed when the `Work State` owner is activated | Workflow Coordinator records the result; the subject-matter Role/activity retains authority for the underlying semantic decision | Method route/transition conditions satisfied; any applicable human, quality, or evidence gate already satisfied. Covers `Idea`, `Exploring`, `Designing`, `Awaiting Approval`, `Preparing`, `Implementing`, `Reviewing`, `Validating`, and Method-valid returns upstream |
| Mutate `Work State` from `Preparing` to `Ready` | Allowed when the `Work State` owner is activated | Workflow Coordinator records the established Readiness result | Valid `READY` or `READY WITH RISKS` result exists; prior authority gates satisfied |
| Create branch | Allowed for authorized implementation/governance scope | Active Role authorized to modify that scope | Applicable upstream authority/gates satisfied |
| Modify repository code/docs | Allowed only for authorized scope | Active Role owns the relevant implementation/design/governance activity | Must preserve upstream owners and applicable gates |
| Create or update PR | Allowed for authorized scope | Active Role proposing the repository change; Workflow Coordinator may maintain operational PR metadata | PR must not be treated as approval or merge authority |
| Write Code / Architecture / Functional review output | Allowed | Corresponding review Role with refreshed context | Applicable review context resolved |
| Mutate `Work State` to `Done` / close completed Work | Allowed only to record an established completion result and when the backing owners are activated | Workflow Coordinator records closure; it MUST NOT manufacture missing review/validation acceptance | Done invariants, applicable Quality Gate, and Evidence Gate satisfied |
| Close Work as `not planned` / `duplicate` | Not granted to AI by default | Human or Workflow Coordinator explicitly delegated delivery-disposition authority | Must preserve last valid Work State; disposition is not `Done` |
| Merge PR | Not granted by this policy | Separate project/repository merge authority required | Applicable project/repository merge requirements satisfied |

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

- translate native `Status` into `Work State`;
- mark a Work `Ready` without Readiness;
- mark a Work `Done` when a PR merges;
- execute human-only approvals;
- change Priority as a substitute for delivery authority.

## 12. Architecture Web delivery expectations

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

## 13. Architecture Web architecture criteria

When architecture is affected, use these canonical project owners:

- [Architecture principles](architecture-principles.md);
- [Architecture overview](../architecture/overview.md);
- [Dependency rules](../architecture/dependency-rules.md);
- [Packages and public APIs](../architecture/packages.md);
- [ADRs](../architecture/decisions/README.md).

Do not infer a preferred pattern from a historical implementation exception.
Implementation evidence may reveal drift but does not silently replace canonical
architecture constraints.

## 14. Validation bindings

Architecture Web's concrete validation strategy and commands are owned by
[Testing and verification](../development/testing.md). Work should use only the
checks necessary for its type, depth, characteristics, and affected boundaries.

## 15. Common Architecture Web routes

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

## 16. Legacy artifact metadata

Existing process documents use a `Lifecycle` metadata field created before Work
State and artifact maturity were explicitly separated. For those documents,
values such as `Design`, `Approved`, `Implementation`, `Review`, or `Validation`
should be interpreted as **artifact/work-scope maturity metadata**, not as a
claim that these words are generic Work States in the new method.

New workflow reasoning should use the Work States defined by the generic
[Lifecycle](../../external/software-engineering-method/lifecycle.md). A separate migration of legacy metadata may
be performed later when it provides enough value to justify repository churn.
