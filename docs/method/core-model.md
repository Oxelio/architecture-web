# Software Engineering Method — Core model

> **Content status:** Canonical
>
> **Document type:** Engineering Method
>
> **Domain:** Method foundations

## 1. Method versus project

The method defines how software work is governed. It does not define the
architecture of the software being built.

A project owns:

- product vision and scope;
- product/domain rules;
- architecture and technology choices;
- development and documentation conventions;
- concrete decisions and implementation;
- validation evidence.

The method owns:

- lifecycle semantics;
- work classification;
- artifact ownership rules;
- human gates;
- AI role boundaries;
- context-resolution rules;
- readiness, review, and validation semantics;
- decision-memory rules.

## 2. Normative vocabulary

### Work

A **Work** is the unit of change or investigation followed by the method.

### Work Type

A **Work Type** describes the primary intent of the work: why the work exists.

### Change Characteristic

A **Change Characteristic** is a property that affects risk, required context,
review, or validation without defining the primary intent.

### Workflow Depth

**Workflow Depth** (`Quick`, `Standard`, or `Complex`) describes how much
engineering governance the work requires. It measures decision and change risk,
not lines of code, file count, or estimated duration.

### Work State

A **Work State** describes where the work is in its lifecycle.

### Activity

An **Activity** describes what is being done now. Activities such as Technical
Design, Task Planning, Readiness Review, and Architecture Review are not Work
States.

### Artifact

An **Artifact** records durable truth, execution intent, temporary workflow
memory, or evidence. Its authority is determined by its responsibility, not by
its recency or size.

### Gate

A **Gate** controls a lifecycle transition. Authority, readiness, quality, and
evidence gates have different responsibilities and must not be conflated.

### Role

A **Role** is a capability and authority contract for the current activity. A
role is not a persona and does not require a separate physical AI agent.

## 3. Truth model

### Current Truth

Describes what is effective now. Current architecture documentation is a typical
owner of current structural truth.

### Approved Target

Describes behavior or design accepted for an identified work scope but not
necessarily effective yet. Approved Functional Specifications and Technical
Designs are typical target owners.

### Historical Rationale

Describes why a durable structural decision was made. ADRs own this rationale;
Git owns previous repository states.

An approved target MUST NOT be silently described as current truth before it is
effective.

## 4. Authority is scoped

Authority is not a global document ranking. Ask what subject is being resolved.

Examples:

- approved product behavior -> Functional Specification;
- current implementation behavior -> code and executable tests as evidence;
- current system architecture -> current architecture documentation, checked
  against implementation evidence;
- rationale for a durable structural architecture decision -> ADR.

When relevant sources conflict:

1. identify the subject of the conflict;
2. identify each source's authority scope;
3. identify the expected authoritative owner;
4. expose the conflict;
5. do not silently reconcile it;
6. route correction to the owner or implementation that must change.

## 5. Core invariants

1. Every durable fact MUST have one identifiable authoritative owner.
2. Dependent artifacts MAY summarize for context but MUST NOT establish a
   competing normative variant.
3. Technical Design MUST NOT silently redefine approved functional behavior.
4. Implementation constraints MUST NOT silently become product/domain rules.
5. AI working context does not become canonical merely because it was discussed
   or generated.
6. An AI MUST NOT execute a human-only authority gate.
7. A role MUST escalate decisions outside its authority instead of hiding them
   in code, tasks, reviews, or temporary decisions.
8. Context MUST be sufficient for the current decision, not maximal by default.
9. Work MUST return to the owner/activity able to resolve an upstream problem
   discovered later in the lifecycle.
10. Documentation, workflow depth, review, and validation MUST be proportional
    to uncertainty, impact, risk, and architectural significance.
11. A decision being approved does not by itself make its target state effective.
12. Git is history; ordinary `old`, `backup`, `v2`, dated, or parallel copies
    MUST NOT be used as documentation history.

## 6. Configure, extend, deviate

An adopting project may:

- **configure** a method-defined project policy slot;
- **extend** the method with stricter project-specific requirements;
- **deviate** from a method invariant only explicitly, with an identifiable
  owner, rationale, and authority.

A project-specific architecture rule is an extension/configuration, not a
method invariant. For example, bounded contexts and ports/adapters may be
mandatory for Architecture Web without becoming mandatory for every project
using this method.
