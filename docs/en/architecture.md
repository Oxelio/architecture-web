# Architecture

## Architectural overview

The project is organized around a clear separation of layers:

- a web API layer,
- an application layer,
- a business bounded context,
- and infrastructure layers.

This structure was chosen to keep the codebase maintainable as the number of features grows.

## Main components

### 1. API application

The [apps/api](../../apps/api) folder contains the network entrypoint of the system. It is responsible for:

- creating the HTTP server,
- registering routes,
- translating HTTP requests into use case calls,
- formatting responses for the client.

The API does not contain business logic itself. Its role is to transport user intent toward the use cases of the bounded context.

### 2. Identity bounded context

The [bounded-contexts/identity](../../bounded-contexts/identity) folder contains the business logic related to identity: registration, sign-in, email verification, email change, password change, activation, and suspension.

This area is intentionally isolated to express a coherent and autonomous business domain.

### 3. Foundation

The [foundation](../../foundation) package provides common abstractions used by the domain: entities, value objects, and results. These abstractions remain intentionally simple so they do not impose a specific framework or library.

### 4. Infrastructure

The infrastructure packages provide concrete adapters for:

- persistence with Kysely,
- sessions with Redis,
- password hashing with Argon2 or bcrypt,
- email delivery through an external service.

The aim is to make external dependencies replaceable without modifying the core system.

## Why this structure

This organization addresses several needs:

- preserving business rules at the center of the system,
- limiting the impact of technical changes on the domain,
- simplifying testing,
- making components interchangeable.

## Dependency flow

A typical flow is:

1. an HTTP request reaches the API;
2. the controller delegates to a use case;
3. the use case uses domain objects and ports;
4. the ports are implemented by infrastructure adapters;
5. the result is returned to the client through a presenter or HTTP response.

## Architectural boundaries

The main boundaries are:

- between the API and the application,
- between the application and the domain,
- between the domain and the infrastructure.

These boundaries matter because they prevent technical details from polluting the business logic.

## Technical choices and trade-offs

### Domain / infrastructure separation

This choice solves the problem of tight coupling to databases, cache systems, or external services. The trade-off is a slightly higher initial complexity, compensated by better maintainability.

### Dependency injection through the composition root

The API entrypoint builds dependencies and injects them into the use cases. This makes the application clearer and easier to test. The trade-off is that initial system wiring is a bit more explicit.

### Dedicated identity bounded context

This separation allows identity to be treated as an autonomous domain. The trade-off is that boundaries must be maintained carefully to avoid other features spilling into this context.
