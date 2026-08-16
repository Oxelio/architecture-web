# Template — Technical Design

Create a Technical Design after the corresponding functional behavior is
approved and only when architecture work is needed.

```markdown
# Technical Design — <feature>

**Lifecycle:** Technical Design
**Content status:** Proposed
**Document type:** Technical Design
**Domain:** <bounded context / technical area>

## Position in the pipeline

**Functional source:** <link to Approved Functional Specification>

**To move to Ready:** validate the architecture, dependencies, acceptance
criteria, migration/compatibility needs, and test strategy; then create
verifiable implementation tasks.

## 1. Functional constraints to preserve

...

## 2. Bounded-context ownership

...

## 3. Domain responsibilities and invariants

...

## 4. Application responsibilities / use cases

...

## 5. Ports and external capabilities

...

## 6. Adapters and composition

...

## 7. Data and state

...

## 8. Flows and interfaces

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

## 14. Error handling

...

## 15. Test strategy

...

## 16. Technical alternatives and trade-offs

...

## 17. ADRs created or referenced

...

## 18. Risks and open technical decisions

...

## 19. Definition of Ready checklist

- [ ] Functional Specification is Approved
- [ ] Architecture is sufficiently decided
- [ ] Dependencies are known
- [ ] Acceptance criteria are available
- [ ] Test strategy is defined
- [ ] Migration/compatibility is understood when applicable
- [ ] Tasks are small and verifiable
```
