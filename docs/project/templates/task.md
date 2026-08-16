# Template — Implementation Task

A task is a small, verifiable execution unit. It references source documents
instead of becoming a competing specification.

```markdown
# Task — <short objective>

**Lifecycle:** Ready
**Document type:** Implementation Task
**Domain:** <bounded context / technical area>

## Objective

...

## Sources of truth

- Functional Specification: <link>
- Technical Design: <link when applicable>
- ADRs: <links when applicable>

## Context

...

## Relevant architectural constraints

...

## Acceptance criteria

- [ ] ...

## Expected tests / validation

...

## Non-goals

...

## Notes for implementation

Inspect the existing repository before choosing local implementation details.
Do not introduce a new architectural pattern or silently diverge from the
source documents to make this task easier.
```
