# Template — GitHub Task Sub-issue

A Task is a small, verifiable execution unit represented as a GitHub Sub-issue
when Task Planning is triggered and the Task/Sub-issue mapping is effectively
activated under the Architecture Web delivery policy. It references authoritative
sources instead of becoming a competing specification or hidden Technical Design.

If that mapping is not activated or is unavailable, this template does not create
a substitute operational owner. Surface the limitation rather than maintaining a
parallel Task representation merely to emulate the GitHub shape.

Use the following structure as **Sub-issue body guidance** rather than creating a
separate Markdown Task artifact in the repository:

```markdown
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
Task requires a new functional, structural architecture, governance, or other
upstream decision, surface the blocker instead of deciding it silently in code.
```

For `Quick` Work, do not create a Sub-issue solely to satisfy this template. An
activated owning Work Issue may be the sufficient execution unit.

Historical Markdown Task files remain available through Git history. New Tasks
SHOULD use GitHub Sub-issues once the Task/Sub-issue mapping is effectively
activated under the GitHub delivery policy.
