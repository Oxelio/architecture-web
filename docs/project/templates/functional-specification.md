# Template — Functional Specification

A Functional Specification describes **what** an approved candidate feature
must do. Keep infrastructure choices out of this document unless they are an
explicit product constraint.

```markdown
# <Feature name>

> **Identifier:** SF-<DOMAIN>-<NNN>
>
> **Lifecycle:** Design
>
> **Content status:** Proposed
>
> **Document type:** Functional Specification
>
> **Domain:** <bounded context>

## Position in the pipeline

**Why this is in Design:** the behavior is coherent enough to review as a
solution, but it has not yet been approved for implementation.

**To move to Approved:** resolve blocking functional decisions, verify the
acceptance criteria, and explicitly approve the behavior for an identified
scope.

## 1. Business context / problem

...

## 2. Functional objective

...

## 3. Actors and authorization

...

## 4. Scope and non-goals

...

## 5. Functional rules and invariants

...

## 6. States and significant transitions

...

## 7. Functional dependencies and interactions

...

## 8. Observable behavior / UX expectations

...

## 9. Errors, edge cases and failure behavior

...

## 10. Security and privacy requirements

...

## 11. Alternatives considered

...

## 12. Open decisions

...

## 13. Acceptance criteria

- [ ] ...

## 14. Approval decision

**Decision:** <Pending | Approved>

**Scope:** ...
```
