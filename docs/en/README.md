# Project documentation

This documentation describes the architecture implemented in the repository.
The project is a TypeScript pnpm monorepo made of a React application, a Fastify
API, and packages for the IAM domain and its adapters.

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
- [Security configuration redesign](architecture/security-configuration-redesign.md)
- [Architectural decisions](architecture/decisions/README.md)

### Development

- [Setup and runtime](development/getting-started.md)
- [Conventions](development/conventions.md)
- [Tests and verification](development/testing.md)
- [Adding a feature](development/adding-a-feature.md)

### Guides and reference

- [Authentication and sessions](guides/iam-sessions.md)
- [User administration](guides/iam-user-administration.md)
- [Password policy](guides/password-policy.md)
- [Account security, MFA, audit, and configuration](guides/account-security.md)
- [HTTP interface](reference/http-api.md)
- [Functional specifications](specifications/README.md)

## Sources of truth

- Package exports are defined by each `package.json` and index file.
- Application contracts live in
  `packages/iam/core/application/<capability>/use-cases`.
- Historical IAM routes and their HTTP schemas live in
  `apps/api/src/features/iam`.
- Recovery, MFA, audit, configuration, export, and deletion live in
  `apps/api/src/security`; those routes do not yet have complete TypeBox
  schemas.
- Available commands are the scripts in `package.json` files.
- Swagger at `/docs` is executable reference for schema-backed routes. Also use
  the [HTTP reference](reference/http-api.md) for security routes.

Documentation explains these sources; it does not replace them.
