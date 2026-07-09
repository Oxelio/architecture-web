# AI guidelines

## Project context

This repository illustrates a modular architecture centered on identity. The goal is not merely to implement authentication routes, but to preserve a clear separation between business responsibilities and technical concerns.

## Mental model of the project

When modifying this project, think in layers:

- domain: business rules and entities,
- application: orchestration of use cases,
- infrastructure: technical implementations,
- API: adaptation to the HTTP protocol.

## Rules for code changes

Modifications should respect the following invariants:

- do not introduce business logic into the API,
- do not make the domain depend on Redis, PostgreSQL, or Fastify,
- preserve the boundaries between ports and adapters,
- avoid changes that blur responsibilities between layers.

## Code generation instructions

New features should:

- follow the naming conventions already used,
- use use cases for orchestration,
- keep entities and value objects at the heart of the domain,
- expose external dependencies through abstractions.

## Project map

- [apps/api](../../apps/api): HTTP entrypoint and composition root.
- [bounded-contexts/identity](../../bounded-contexts/identity): business logic related to identity.
- [foundation](../../foundation): base abstractions for the domain.
- [infrastructure](../../infrastructure): concrete technical implementations.
