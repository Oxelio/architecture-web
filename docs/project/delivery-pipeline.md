# Architecture Web — Delivery pipeline and artifacts

> **Lifecycle:** Approved
>
> **Content status:** Canonical
>
> **Document type:** Project Governance
>
> **Domain:** Delivery / Architecture

## 1. Purpose

This document defines how a product or architecture topic progresses from an
idea to validated software, and which artifacts own information at each stage.

The pipeline is intentionally not a mandatory checklist for every change.
Artifact creation is proportional to uncertainty, impact, and architectural
risk.

## 2. Delivery flow

The conceptual feature flow is:

> **Idea → Exploration → Functional Specification (Design) → Approved → Technical Design → Ready → Tasks → Implementation → Review → Validation → Done**

The normalized lifecycle states are:

> **Idea → Exploration → Design → Approved → Technical Design → Ready → Implementation → Review → Validation → Done**

`Functional Specification`, `Technical Design`, `Task`, `Review`, and
`Validation Report` are artifact types. They are not all lifecycle states.

An **ADR (Architecture Decision Record)** is transversal. It is created when a
durable structural architecture decision deserves explicit rationale; it is
not a mandatory stage between Functional Specification and Technical Design.

## 3. Idea

Capture a possible need, problem, improvement, or architecture question with no
commitment that it is compatible, desirable, or in scope.

An idea may remain an issue, note, or conversation until further exploration is
valuable.

## 4. Exploration

Exploration answers **what needs to be decided and why**.

Depending on the topic, examine:

- problem or need;
- actors and desired outcome;
- business rules or invariants already known;
- scope and non-goals;
- reasonable options;
- interactions and dependencies;
- risks, trade-offs, security concerns, and failure modes;
- unknowns and open decisions;
- whether a spike, proof of concept, or case study is useful.

An Exploration can be long and detailed without becoming a specification.
When the problem and chosen behavior become coherent, integrate the accepted
conclusions into a Functional Specification or another owning document.

## 5. Design — Functional Specification

For a feature, `Design` is carried by a Functional Specification. It answers
**what behavior the system must provide**, independently of infrastructure.

A Functional Specification normally covers:

- objective and business context;
- actors and authorization expectations;
- scope and non-goals;
- functional rules and invariants;
- states and significant transitions;
- user-visible or externally observable behavior;
- errors and edge cases;
- functional dependencies;
- acceptance criteria;
- remaining non-blocking decisions.

It should not prescribe Fastify, React, Kysely, Redis, tables, controllers,
concrete adapters, or other implementation choices unless such a technology is
itself an explicit product constraint.

## 6. Approved

`Approved` means the functional behavior has been explicitly accepted for an
identified scope and may drive technical design.

Before approval, verify at least:

- the objective and actors are clear;
- important functional rules and invariants are explicit;
- scope and non-goals are understood;
- significant edge cases and failures are identified;
- dependencies are visible;
- blocking product decisions are resolved;
- acceptance criteria are testable;
- the decision to implement the behavior is explicit.

Approval does not freeze every secondary parameter forever.

## 7. Technical Design

Technical Design answers **how the approved behavior will fit the architecture**.
It must preserve the Functional Specification rather than silently rewrite it.

Depending on the feature, cover:

- bounded-context ownership;
- domain responsibilities and consistency boundaries;
- application use cases and orchestration;
- ports and external capabilities;
- adapter and composition responsibilities;
- data and state representation;
- interfaces and data flow;
- transactions, idempotency, concurrency, messaging, and consistency;
- security and privacy;
- migrations and backward compatibility;
- performance and operational limits;
- error handling;
- test strategy;
- technical risks and open decisions.

A local technical choice may remain in the Technical Design. A durable,
cross-cutting, or hard-to-reconstruct architecture choice may trigger an ADR.

## 8. ADR — Architecture Decision Record

An ADR records **why a durable structural architecture decision was made**.
Create one when several reasonable alternatives exist and the decision is
important enough that future maintainers would otherwise need to rediscover the
context.

Good ADR candidates include package boundaries, communication between bounded
contexts, transaction/integration strategies, contract ownership, persistence
strategy with broad consequences, or an intentional architecture exception.

Do not create an ADR for routine naming, formatting, or obvious local
implementation choices.

An ADR typically contains context, problem, decision drivers, options,
decision, consequences, status, and documents that must reflect the decision.
The current architecture document remains the owner of current rules; the ADR
owns their historical rationale.

## 9. Ready

A feature is `Ready` when implementation can begin without unresolved
architecture work that would invalidate task planning.

Definition of Ready:

- Functional Specification is `Approved`;
- Technical Design is sufficiently validated when one is needed;
- dependencies and prerequisites are identified;
- acceptance criteria are available;
- test strategy is known;
- migration or compatibility requirements are known when applicable;
- implementation tasks are small enough to be independently understandable
  and verifiable.

## 10. Tasks

Tasks are execution units, not new sources of truth. They reference the
Functional Specification, Technical Design, and relevant ADRs instead of
copying them.

A good task defines:

- objective;
- local context;
- source documents;
- architectural constraints relevant to the task;
- acceptance criteria;
- expected tests;
- non-goals when they prevent accidental scope growth.

A coding agent or developer should inspect the repository before choosing local
implementation details. Tasks should not prescribe unnecessary file-by-file
implementation when the architecture already provides the constraint.

## 11. Implementation

The change is being built. Any necessary divergence from approved behavior or
architecture must be surfaced and resolved in the owning document or an ADR;
it must not become the new rule merely because code was written first.

## 12. Review

Review has three distinct questions:

1. **Code review** — is the implementation readable, maintainable, tested, and
   free from unnecessary complexity or duplication?
2. **Architecture review** — does it respect bounded-context boundaries,
   dependency direction, ports/adapters, domain/application separation, and
   applicable ADRs?
3. **Functional compliance review** — does the implementation actually satisfy
   the Functional Specification and acceptance criteria?

Security, performance, data migration, or operational review may be added when
risk requires them.

## 13. Validation

Validation is the software equivalent of a playtest: it provides evidence that
the resulting behavior works at the required boundaries.

Use only the levels needed for the feature:

- unit tests;
- domain/application behavior tests;
- adapter/integration tests;
- contract tests;
- end-to-end tests;
- acceptance tests;
- security checks;
- migration verification;
- performance checks;
- manual validation where automated evidence is not sufficient.

A Validation Report is useful for significant changes, releases, migrations,
or risks; it is not mandatory for every small change.

## 14. Done

A change is `Done` when the agreed scope is implemented, reviewed, validated,
and the owner documentation reflects the behavior and architecture that
actually remain in the repository.

## 15. Alternative paths

The full pipeline is for meaningful feature work, not bureaucracy.

Examples:

```text
Small bug
Task → Implementation → Review → Validation as needed → Done

Cross-cutting architecture decision
Idea/Exploration → ADR → architecture documentation → implementation/review

Research question
Exploration → Spike/POC → conclusion integrated into owner → Done

Feature
Exploration → Functional Specification → Approved → Technical Design
→ Ready/Tasks → Implementation → Review → Validation → Done
```

A subject may move backward when review or validation discovers a wrong
functional assumption or architecture decision.
