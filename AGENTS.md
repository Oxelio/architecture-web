# Architecture Web — Agent instructions

This repository is canonical. Do not treat conversation history, generated
prompts, historical exceptions, or nearby code as authority over current owner
documents.

## Before work

1. Read the relevant rules in [`docs/method/`](docs/method/README.md).
2. Resolve project owners through
   [`docs/project/project-method-profile.md`](docs/project/project-method-profile.md).
3. For architecture work, read:
   - [`docs/project/architecture-principles.md`](docs/project/architecture-principles.md);
   - [`docs/architecture/overview.md`](docs/architecture/overview.md);
   - [`docs/architecture/dependency-rules.md`](docs/architecture/dependency-rules.md);
   - relevant ADRs.
4. For product behavior, identify the owning Approved Functional Specification
   or surface that no approved owner exists.
5. Use a focused Context Manifest for meaningful work rather than loading all
   project documentation by default.

## Architecture

Architecture Web uses DDD, Clean Architecture, Hexagonal Architecture, SOLID,
autonomous bounded contexts, inward dependency direction, explicit application
contracts, and infrastructure-independent domain/application layers.

These are project rules, not generic method rules. Do not introduce a port,
repository, service, factory, event, abstraction, or framework mechanically.

Do not turn an implementation limitation into a domain/product rule. If current
code conflicts with canonical architecture or approved behavior, surface the
conflict rather than copying the exception.

## Implementation

- Implement only the authorized Task/work scope.
- Inspect the repository before choosing local implementation details.
- Preserve approved Functional Specifications, applicable Technical Designs,
  ADRs, and public package contracts.
- Escalate functional, architecture, or task blockers instead of making hidden
  upstream decisions in code.
- Follow [`docs/development/conventions.md`](docs/development/conventions.md).

## Validation

Use the proportional strategy in
[`docs/development/testing.md`](docs/development/testing.md).

Root commands:

```bash
pnpm build
pnpm typecheck
pnpm typecheck:test
pnpm lint
pnpm test
pnpm test:coverage
pnpm format:check
```

Run only the smallest sufficient affected subset during iteration, then expand
validation when the changed boundary or public contract requires it.

For documentation-only changes, validate relative links/paths, formatting, and
`git diff --check` as described in the testing guide.

## Documentation

Canonical repository documentation is English. Git is history. Do not create
ordinary `old`, `backup`, `v2`, dated, or parallel-language documentation
copies.

Tasks, Context Manifests, Working Decision Logs, handoffs, and review notes must
reference canonical owners rather than becoming competing specifications.
