# Architecture Web — Project scope

> **Lifecycle:** Approved
>
> **Content status:** Canonical
>
> **Document type:** Scope
>
> **Domain:** Project Direction

## Current scope

The repository currently demonstrates a TypeScript web application centered on
identity and access management, including an HTTP API, a React client, domain
and application packages, and specialized infrastructure adapters.

The documented architecture currently covers concepts including:

- account creation and identity management;
- authentication and sessions;
- email verification;
- password policy and password recovery;
- user administration;
- MFA;
- security audit;
- dynamic security configuration;
- account export and deletion;
- messaging, audit, and notification integration;
- persistence, Redis sessions/rate limits, hashing, and email delivery;
- explicit package and dependency boundaries.

See [Architecture overview](../architecture/overview.md) and
[Functional specifications](../specifications/README.md) for current detail.

## Architectural scope

Architecture Web is intentionally used to explore and validate:

- Domain-Driven Design and bounded-context boundaries;
- Clean Architecture dependency direction;
- Hexagonal Architecture and ports/adapters;
- explicit application contracts;
- independently testable domain and application behavior;
- composition of concrete infrastructure at application edges;
- asynchronous integration where it is justified;
- maintainable package/public API boundaries;
- a documentation and delivery workflow usable by humans and coding agents.

## Out of scope by default

The project does not imply that every possible enterprise pattern must be
implemented. The following require a concrete need before becoming scope:

- microservices solely for distribution;
- generic event sourcing;
- a universal workflow/rules engine;
- a generic repository abstraction over all persistence;
- framework-independent wrappers around stable libraries without a boundary
  reason;
- infrastructure duplication solely to demonstrate alternatives;
- exhaustive product features unrelated to the architectural questions being
  exercised.

## Scope changes

A new feature enters delivery through the pipeline in
[Architecture Web delivery profile](delivery-pipeline.md). A structural change to
the architecture may additionally require an ADR. Mentioning an idea in this
scope does not make a future implementation implicitly approved.
