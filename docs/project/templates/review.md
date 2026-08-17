# Template — Review

Use this record when the change benefits from durable review evidence. Small
changes may rely on pull-request history. Review semantics are owned by the
[Software Engineering Method](../../method/review-validation.md).

```markdown
# Review — <work>

**Artifact status:** Complete | Changes Required
**Content status:** Historical Record
**Document type:** Review
**Domain:** <project area>

## Reviewed change

...

## Sources

- Functional Specification: ...
- Technical Design: ...
- ADRs: ...
- Tasks / pull request: ...

## 1. Code Review

**Applicable:** yes/no

**Findings:** ...

## 2. Architecture Review

**Applicable:** yes/no

Architecture Web criteria include bounded-context ownership, dependency
direction, domain/application/infrastructure separation, ports/adapters,
aggregate/transaction boundaries, package/public contracts, and applicable ADRs.

**Findings:** ...

## 3. Functional Compliance Review

**Applicable:** yes/no

Compare implementation with the Approved Functional Specification and
acceptance criteria.

**Findings:** ...

## 4. Specialist review

Security, privacy, migration, compatibility, performance, operational, or other
Change Characteristics when applicable.

**Findings:** ...

## 5. Required return path

<Implementing | Preparing / Technical Design | Designing / Functional work | none>

## 6. Conclusion

<Accepted for validation | Changes Required>
```
