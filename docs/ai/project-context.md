# Architecture Web — AI project context

Architecture Web is a TypeScript reference application centered on identity and
access management.

## Architecture direction

The project follows:

- Domain-Driven Design;
- Clean Architecture;
- Hexagonal Architecture;
- autonomous bounded contexts;
- dependency inversion;
- explicit application contracts and ports;
- infrastructure-independent domain and application layers;
- proportional documentation and testing.

Do not infer an architectural pattern from a historical exception. Read the
current architecture documentation and code before proposing a change.

## Canonical references

- [Vision](../project/vision.md)
- [Architecture principles](../project/architecture-principles.md)
- [Scope](../project/scope.md)
- [Delivery pipeline](../project/delivery-pipeline.md)
- [Architecture overview](../architecture/overview.md)
- [Dependency rules](../architecture/dependency-rules.md)
- [Packages](../architecture/packages.md)
- [Functional specifications](../specifications/README.md)
- [ADRs](../architecture/decisions/README.md)

## Delivery rule

For meaningful feature work, separate:

1. exploration of the problem and alternatives;
2. functional specification of approved candidate behavior;
3. technical design after functional approval;
4. small implementation tasks;
5. implementation;
6. code, architecture, and functional review;
7. validation at the required test boundaries.

An ADR is created only when a durable structural architecture decision merits
preserving its rationale.
