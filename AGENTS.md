# Architecture Web — Agent instructions

This repository is canonical for repository-owned truth. Do not treat
conversation history, generated prompts, historical exceptions, nearby code, or
GitHub operational records as authority over current owner documents.

Architecture Web defines GitHub Issues/Projects mappings for operational Work
tracking in [`docs/project/delivery-pipeline.md`](docs/project/delivery-pipeline.md).
GitHub is canonical only for operational subjects that are both explicitly
assigned and effectively activated there. Until a mapping is activated, treat
that operational owner as unavailable rather than inventing a substitute owner.

## Before work

1. Read the relevant generic rules in the canonical
   [Software Engineering Method](external/software-engineering-method/README.md).
2. Resolve project owners through
   [`docs/project/project-method-profile.md`](docs/project/project-method-profile.md).
3. Resolve the owning GitHub Work Issue and Project `Work State` only when the
   corresponding mappings are effectively activated and the owners are available.
   If a mapping is not activated or an activated owner cannot be read, surface
   the limitation instead of inferring a competing owner or Work State.
4. For architecture work, read:
   - [`docs/project/architecture-principles.md`](docs/project/architecture-principles.md);
   - [`docs/architecture/overview.md`](docs/architecture/overview.md);
   - [`docs/architecture/dependency-rules.md`](docs/architecture/dependency-rules.md);
   - relevant ADRs.
5. For product behavior, identify the owning Approved Functional Specification
   or surface that no approved owner exists.
6. Use a focused Context Manifest for meaningful work rather than loading all
   project documentation by default.
7. Before any GitHub mutation, distinguish tool capability, active Role
   authority, project operational permission, and external-owner activation.

## Orchestration

An agent may coordinate work across Method Roles, but orchestration does not
create a super-role. When the Activity or Role changes materially, make the
transition explicit and refresh the relevant context.

Never cross a human-only authority gate automatically. Follow the operational
permission matrix in the project delivery profile before creating/updating Work
records, moving `Work State`, closing Work, or performing other workflow
mutations.

A merged PR is not automatically `Done`. Native GitHub Project `Status` is the
operational Work State owner only when the mapping assigned by
`docs/project/delivery-pipeline.md` is effectively activated and readable;
otherwise Work State is unavailable rather than inferred.

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
- Use GitHub Sub-issues for Tasks only when Task Planning is triggered and the
  Task/Sub-issue mapping is effectively activated and available; do not create
  artificial Sub-issues for Quick work or substitute records for an unavailable
  mapping.
- Inspect the repository before choosing local implementation details.
- Preserve approved Functional Specifications, applicable Technical Designs,
  ADRs, and public package contracts.
- Escalate functional, architecture, governance, or task blockers instead of
  making hidden upstream decisions in code.
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

Tasks, Context Manifests, Working Decision Logs, handoffs, review notes, Issues,
and Pull Requests must reference canonical owners rather than becoming
competing specifications.
