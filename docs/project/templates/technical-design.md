# Template — Technical Design

Create a Technical Design when the method trigger applies. For product behavior,
start from an Approved Functional Specification. This template adds
Architecture Web-specific DDD/Clean/Hexagonal concerns to the generic artifact
semantics.

```markdown
# Technical Design — <work>

**Artifact status:** Proposed
**Content status:** Proposed
**Document type:** Technical Design
**Domain:** <bounded context / technical area>

## Work context

**Work Type:** <...>

**Workflow Depth:** <Standard | Complex>

**Authorized functional source:** <Approved Functional Specification when applicable>

**Architecture owners:**

- <relevant project architecture sources>

## 1. Authorized behavior / constraints to preserve

Reference owners; do not copy a second normative specification.

## 2. Bounded-context / responsibility ownership

...

## 3. Domain responsibilities and consistency boundaries

...

## 4. Application responsibilities / use cases

...

## 5. Ports and external capabilities

...

## 6. Adapters and composition

...

## 7. Data and state

...

## 8. Flows, interfaces and contracts

...

## 9. Transactions, consistency, concurrency and idempotency

...

## 10. Messaging / cross-context integration

...

## 11. Security and privacy

...

## 12. Migration and compatibility

...

## 13. Performance and operational limits

...

## 14. Error and failure handling

...

## 15. Validation strategy

...

## 16. Technical alternatives and trade-offs

...

## 17. ADR candidates / referenced ADRs

...

## 18. Risks and unresolved technical decisions

...

## 19. Task-planning inputs

Dependencies, sequencing constraints, implementation boundaries, and other
information needed for focused Tasks.
```

Task Planning and formal Readiness Review occur after the required design is
sufficiently resolved. Do not embed a second Readiness checklist in every
Technical Design; use the method's [Readiness Review](../../../external/software-engineering-method/readiness-review.md).
