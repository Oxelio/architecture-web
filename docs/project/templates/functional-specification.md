# Template — Functional Specification

A Functional Specification owns proposed/approved **product behavior**. Keep
implementation choices out unless they are genuine product constraints.

```markdown
# <Feature name>

> **Identifier:** SF-<DOMAIN>-<NNN>
>
> **Artifact status:** Proposed
>
> **Content status:** Proposed
>
> **Document type:** Functional Specification
>
> **Domain:** <product/domain area>

## Work / authority context

**Work Type:** Product Behavior Change

**Approval:** Pending Human Functional Approval

**Source Exploration:** <link when applicable>

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

## 11. Functional alternatives considered

...

## 12. Open functional decisions

...

## 13. Acceptance criteria

- [ ] ...

## 14. Human approval

**Decision:** Pending | Approved | Rejected

**Approved scope:** ...

**Authority / record:** ...
```

After explicit approval, update the artifact status/content authority according
to project conventions. Technical Design may then rely on the approved behavior
but may not redefine it silently.
