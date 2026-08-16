# Coding-agent task guidance

A coding agent should receive a focused implementation objective and links to
canonical context, not an alternative architecture hidden inside the prompt.

## Recommended task shape

```text
Objective
<small, observable implementation outcome>

Sources of truth
- Functional Specification: <path>
- Technical Design: <path, if applicable>
- ADRs: <paths, if applicable>

Context
<only local context needed for this task>

Architectural constraints
- preserve bounded-context ownership;
- preserve Clean/Hexagonal dependency direction;
- domain/application must not depend on infrastructure;
- use existing public contracts and patterns where appropriate;
- do not add speculative abstractions.

Acceptance criteria
- ...

Expected tests
- ...

Non-goals
- ...

Inspect the repository before implementation. If the current architecture
prevents a clean implementation, surface the conflict rather than introducing
an undocumented workaround.
```

## Agent output should be reviewed against three dimensions

1. **Code quality** — readability, maintainability, complexity, tests, errors;
2. **Architecture compliance** — boundaries, dependencies, ports/adapters,
   aggregates, ADRs;
3. **Functional compliance** — specification rules and acceptance criteria.
