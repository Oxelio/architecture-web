# Architecture Web — Delivery profile

> **Content status:** Canonical
>
> **Document type:** Project Governance
>
> **Domain:** Delivery / Architecture

## 1. Purpose

Architecture Web adopts the generic [Software Engineering Method](../method/README.md).
The method owns Work Types, Workflow Depth, Work States, Activities, artifact
triggers, gates, AI roles, Context Manifest semantics, Readiness Review,
Working Decision Log, Review, Validation, and the distinction between lifecycle
and delivery planning.

This document owns Architecture Web's **project-specific delivery policy**. It
binds method semantics to GitHub without making GitHub the universal source of
product, architecture, governance, implementation, or evidence truth.

See also the [Project Method Profile](project-method-profile.md).

## 2. Delivery platform and ownership

Architecture Web uses GitHub as its operational delivery platform:

```text
Work execution identity        -> top-level GitHub Issue
Task execution unit            -> GitHub Sub-issue
Operational Work State         -> GitHub Project field: Work State
Delivery ordering              -> GitHub Project
Implementation/review vehicle  -> Pull Request
```

These operational owners reference, rather than replace, durable owners:

```text
Approved product behavior      -> Functional Specification
Technical target               -> Technical Design
Durable structural rationale   -> ADR
Current architecture           -> current architecture documentation
Implementation                 -> code
Validation evidence            -> tests / CI / reports / other evidence
```

GitHub is canonical only for the operational subjects explicitly assigned to it
by this document.

## 3. Work and Task representation

### Work Issue

A top-level GitHub Issue is the operational owner of one Method **Work**. It
owns only the information needed to identify, classify, coordinate, and close
that Work.

The Issue body SHOULD remain lightweight:

```text
Objective
<what outcome this Work is trying to achieve>

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

### Task Sub-issue

A GitHub Sub-issue represents a Method **Task** when Task Planning is triggered.
It is not a second Work and does not own a separate Work State.

For `Quick` work, the top-level Issue MAY be a sufficient execution unit and no
artificial Sub-issue is required.

For `Standard` or `Complex` work, create Sub-issues only when implementation
requires delegation, sequencing, or independently verifiable units. Use the
[Task template](templates/task.md) as body guidance.

## 4. Work State

The GitHub Project field `Work State` is Architecture Web's unique operational
owner of the Method Work State.

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

### Native GitHub `Status`

GitHub's native `Status` field is **not** a lifecycle owner for Architecture Web.
If the field cannot be removed, it SHOULD be hidden from operational views and
MUST NOT be maintained as a parallel `Todo / In progress / Done` lifecycle.

Automations MUST NOT infer or mutate `Work State` from native `Status`.

## 5. Classification and delivery fields

The Project SHOULD expose:

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

Use the Method Work Types defined in
[Work classification](../method/work-classification.md).

### Workflow Depth

Single-select:

```text
Quick
Standard
Complex
```

Workflow Depth represents decision/change risk, not estimated duration, story
points, or diff size.

### Priority

Single-select:

```text
P0 — Critical
P1 — High
P2 — Normal
P3 — Low
```

Priority affects delivery ordering only. It does not bypass authority,
readiness, review, or validation gates.

Priority MAY be proposed by any role with sufficient context. Changing the
operational Priority requires delivery-coordination permission from project
policy or explicit human delegation. When that permission is not established,
AI recommends the change instead of applying it.

### Change Characteristics

Represent applicable multi-valued Change Characteristics using labels:

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

Labels are classification aids, not substitutes for the canonical Work Type or
Workflow Depth fields.

## 6. Planning model

Architecture Web uses **Continuous Flow** by default:

```text
Backlog
   ↓
Ready Queue
   ↓
Implementing
   ↓
Reviewing
   ↓
Validating
   ↓
Done
```

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
6. Initial project WIP limit: at most **1 Work in `Implementing`** unless a
   human explicitly accepts a temporary exception.

WIP is an Architecture Web policy, not a generic Method invariant.

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
MUST reference the owning Work Issue when applicable.

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

Tool capability, Role authority, and operational permission are separate.

The default Architecture Web policy is:

| Operation | Default AI policy |
| --- | --- |
| Read repository / Issue / PR / Project | Allowed when relevant to current work |
| Classify Work Type / characteristics / depth | Allowed within Method rules; surface uncertainty |
| Recommend Priority | Allowed |
| Mutate Priority | Only with explicit delivery-coordination permission |
| Create a Work Issue | Allowed when an identified Work needs an operational owner and scope is sufficiently established |
| Update Issue operational context | Allowed within active Role authority; do not rewrite upstream truth |
| Create Task Sub-issues | Allowed after Task Planning triggers and task boundaries are authorized |
| Move to `Designing` / `Preparing` | Allowed when the Method transition conditions are satisfied and no human-only gate is being crossed |
| Move `Preparing -> Ready` | Allowed only after a valid Readiness result permits it |
| Execute Human Functional Approval | Forbidden |
| Cross any project-defined human-only gate | Forbidden |
| Create branch | Allowed for authorized implementation/governance scope |
| Modify repository code/docs | Allowed only within the active Role's authority |
| Create or update PR | Allowed for authorized scope |
| Perform Code / Architecture / Functional Review | Allowed only under the corresponding review Role and with refreshed context |
| Move to `Done` / close completed Work | Allowed only after explicitly verifying Done invariants and project authority |
| Merge PR | Not granted by this policy |

Orchestration is coordination across these permissions, not a new authority
super-role. A material change of Activity or Role SHOULD be made explicit and
SHOULD trigger focused context re-resolution.

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
  describe becomes effective.

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
[Lifecycle](../method/lifecycle.md). A separate migration of legacy metadata may
be performed later when it provides enough value to justify repository churn.
