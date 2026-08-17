# Software Engineering Method — Artifact ownership

> **Content status:** Canonical
>
> **Document type:** Engineering Method
>
> **Domain:** Documentation and truth ownership

## 1. Single-owner rule

Every durable fact MUST have one identifiable authoritative owner. Other
artifacts may provide local summaries or references but MUST NOT create a
competing normative version.

## 2. Durable owner semantics

### Vision

Owns top-level project intent: why the product/project exists.

### Scope

Owns what the project is currently trying to cover and explicit non-goals.

### Functional Specification

Owns approved product behavior for an identified scope: actors, rules,
invariants, states, observable behavior, failures, and acceptance criteria.

It normally owns an **Approved Target**, not a claim that implementation is
already complete.

### Technical Design

Owns how an approved or otherwise authorized work scope is intended to fit the
project's architecture. It MUST preserve authoritative functional behavior and
project architecture constraints.

### Current Architecture Documentation

Owns the architecture that is effective now. It MUST NOT silently present an
approved future target as already current.

### ADR

Owns the context, alternatives, rationale, and consequences of a durable
structural architecture decision. It does not replace current architecture
documentation and is not a changelog.

### Project policy / governance document

Owns the project-specific policy assigned to it, such as canonical
documentation language, validation commands, or architecture constraints.

### Task

Owns an implementation unit, not upstream product or architecture truth. Tasks
reference their sources instead of copying them as a second specification.

## 3. Working artifacts

The following are workflow memory, not durable truth owners:

- Exploration;
- Context Manifest;
- Working Decision Log;
- handoff;
- Readiness Review record;
- temporary research notes.

Accepted conclusions MUST be integrated into the appropriate durable owner.

## 4. Evidence

Code, executable tests, CI results, benchmarks, review findings, migration
checks, and validation reports provide evidence.

Evidence can reveal that implementation conflicts with an authoritative target.
It does not silently redefine the target.

Example:

```text
Approved Functional Specification: token is single-use
Observed implementation: token can be reused
=> implementation conflict / defect, not a new product rule
```

## 5. Decision-to-effect synchronization

Decision acceptance and effective current state are different events.

Example:

```text
Current architecture = A
Accepted target = B
Implementation not complete
```

Current architecture documentation should still describe A while the accepted
target/design describes B. When B becomes effective, synchronize the current
architecture owner.

Before `Done`, ensure all affected durable owners accurately represent the
truth they own.

## 6. Documentation history

Git is the history. Do not preserve ordinary old versions by maintaining
parallel `old`, `backup`, `v2`, dated, or translated copies. Preserve durable
rationale in the proper owner (for example an ADR), not in duplicated documents.
