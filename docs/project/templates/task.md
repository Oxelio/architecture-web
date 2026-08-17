# Template — Implementation Task

A Task is a small, verifiable execution unit. It references authoritative
sources instead of becoming a competing specification or hidden Technical Design.

```markdown
# Task — <short objective>

**Artifact status:** Planned
**Document type:** Implementation Task
**Domain:** <bounded context / technical area>

## Objective

...

## Sources of truth

- Functional Specification: <link when applicable>
- Technical Design: <link when applicable>
- ADRs: <links when applicable>
- Architecture constraints: <links when relevant>

## Local context

...

## Acceptance criteria

- [ ] ...

## Expected tests / validation

...

## Dependencies / sequencing

...

## Non-goals

...

## Implementation authority

Inspect the repository before choosing local implementation details. If this
Task requires a new functional, structural architecture, or other upstream
decision, surface the blocker instead of deciding it silently in code.
```
