# Developer guide

## Prerequisites

- Node.js 20+
- pnpm
- Docker if you want to run the full environment

## Installation

From the repository root:

```bash
pnpm install
```

## Configuration

The API application expects environment variables for the database, Redis, and SMTP. These values are loaded by [apps/api/src/config/app.config.ts](../../apps/api/src/config/app.config.ts).

## Running the project

### API

```bash
cd apps/api
pnpm dev
```

### Migrations

```bash
cd apps/api
pnpm migrate:up
```

## Build and verification

```bash
pnpm --filter api build
pnpm --filter @architecture/identity build
```

## Debugging

The main entrypoint is [apps/api/src/main.ts](../../apps/api/src/main.ts). To follow a complete flow, start with:

- the route in [apps/api/src/routes/identity.routes.ts](../../apps/api/src/routes/identity.routes.ts),
- the relevant use case in [bounded-contexts/identity/application/use-cases](../../bounded-contexts/identity/application/use-cases),
- and the related infrastructure adapter.

## Adding a new feature

1. identify the relevant bounded context,
2. define the business rules in the domain,
3. create an application use case,
4. add the required ports,
5. implement the adapters,
6. expose the feature via the API.

## Best practices

- keep use cases small and coherent,
- avoid direct framework dependencies in the domain,
- evolve abstractions carefully,
- document non-obvious design choices.
