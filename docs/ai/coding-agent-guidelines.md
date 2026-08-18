# Architecture Web — Coding-agent task guidance

Generic Developer/Planner role boundaries are defined by the
[Software Engineering Method](../method/roles.md). This guide adds Architecture
Web-specific implementation context.

Architecture Web represents Tasks as GitHub Sub-issues when Task Planning is
triggered. The owning Work Issue and project [Delivery profile](../project/delivery-pipeline.md)
provide the operational context; canonical repository documents continue to own
product, architecture, governance, and validation truth.

## Recommended Task Sub-issue shape

```text
Objective
<small, observable implementation outcome>

Sources of truth
- Functional Specification: <path, when applicable>
- Technical Design: <path, when applicable>
- ADRs: <paths, when applicable>
- Project architecture constraints: docs/project/architecture-principles.md

Context
<only local context needed for this Task>

Acceptance criteria
- ...

Expected tests / validation
- ...

Non-goals
- ...
```

The agent should resolve operational rules from root [`AGENTS.md`](../../AGENTS.md)
and inspect the repository before choosing local details.

For `Quick` Work, the Work Issue may be the sufficient execution unit. Do not
create a Sub-issue only to satisfy a process shape.

## Architecture Web constraints

When relevant, preserve:

- bounded-context ownership;
- Clean/Hexagonal inward dependency direction;
- domain/application independence from concrete infrastructure;
- explicit application contracts;
- deliberate package public APIs;
- applicable aggregate/transaction boundaries;
- relevant ADRs.

Do not add speculative abstractions or treat a historical exception as a new
pattern.

## Authority and blockers

Tool capability does not expand Developer authority. A coding agent may modify
repository content only within the authorized Work/Task scope.

If implementation requires a new product decision, structural architecture
decision, governance decision, or unresolved Task/design decision, surface the
blocker and return it to the appropriate owner/role. Do not hide the decision
inside code or operational GitHub mutations.

## Review expectations

Review applicable implementation independently for:

1. Code quality;
2. Architecture compliance;
3. Functional compliance;
4. specialist risks activated by the Work characteristics.
