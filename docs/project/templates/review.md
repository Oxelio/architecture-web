# Template — Review

Use this template when a change benefits from a durable review record. Normal
pull-request comments may be sufficient for small changes.

```markdown
# Review — <feature / change>

**Lifecycle:** Review
**Content status:** Historical Record
**Document type:** Review
**Domain:** <bounded context / project area>

## Reviewed change

...

## Sources

- Functional Specification: ...
- Technical Design: ...
- ADRs: ...
- Tasks / pull request: ...

## 1. Code review

- readability and naming;
- duplication and complexity;
- error handling;
- test quality;
- maintainability.

**Findings:** ...

## 2. Architecture review

- bounded-context ownership;
- dependency direction;
- domain/application/infrastructure separation;
- ports and adapters;
- aggregate and transaction boundaries;
- applicable ADRs.

**Findings:** ...

## 3. Functional compliance review

Compare the implementation with functional rules and acceptance criteria.

**Findings:** ...

## 4. Additional risk review

Security, privacy, migration, performance, or operational concerns when
applicable.

**Findings:** ...

## 5. Required changes

...

## 6. Conclusion

<Approved for validation | Return to implementation | Return to Technical Design | Return to Design>
```
