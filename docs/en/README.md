# Project documentation

This documentation describes the architecture implemented in the repository.
The project is a TypeScript pnpm monorepo made of a React application, a Fastify
API, and packages for the Identity domain and its adapters.

## Reading path

New contributors should read:

1. [Overview](architecture/overview.md) — goals, boundaries, and flows;
2. [Layers](architecture/layers.md) — responsibilities at each level;
3. [Dependency rules](architecture/dependency-rules.md) — allowed and forbidden
   imports;
4. [Packages](architecture/packages.md) — public APIs and implementations;
5. [Getting started](development/getting-started.md);
6. [Adding a feature](development/adding-a-feature.md).

## Browse by need

### Architecture

- [Overview](architecture/overview.md)
- [Layers and boundaries](architecture/layers.md)
- [Dependency rules](architecture/dependency-rules.md)
- [Packages and public APIs](architecture/packages.md)
- [Architectural decisions](architecture/decisions/README.md)

### Development

- [Setup and runtime](development/getting-started.md)
- [Conventions](development/conventions.md)
- [Tests and verification](development/testing.md)
- [Adding a feature](development/adding-a-feature.md)

### Guides and reference

- [Authentication and sessions](guides/identity-sessions.md)
- [HTTP interface](reference/http-api.md)

## Sources of truth

- Package exports are defined by each `package.json` and index file.
- Application contracts live in
  `packages/identity/core/application/use-cases`.
- HTTP routes and schemas live in `apps/api/src/features/identity`.
- Available commands are the scripts in `package.json` files.
- The executable HTTP catalog is the Swagger interface served on `/docs`.

Documentation explains these sources; it does not replace them.
