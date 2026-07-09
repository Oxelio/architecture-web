# Important architectural decisions (ADR)

## ADR-001 — Clear separation between domain and infrastructure

### Status

Accepted

### Context

The project must remain understandable even as technical dependencies evolve. Business logic directly coupled to Redis, PostgreSQL, or Fastify would be hard to maintain.

### Decision

The domain and use cases are isolated from technical details through ports and adapters.

### Consequence

The functional core becomes more stable and more testable, at the cost of a slightly more explicit structure.

## ADR-002 — Dedicated bounded context for identity

### Status

Accepted

### Context

Authentication and user management form a coherent domain, but one that is sufficiently autonomous to justify a clear boundary.

### Decision

Code related to identity is grouped in a distinct bounded context.

### Consequence

Responsibilities are clearer and the evolution of the domain is better controlled.

## ADR-003 — Composition root at the API level

### Status

Accepted

### Context

Dependencies need to be assembled in a clear location to avoid scattered configuration.

### Decision

The API builds dependencies and injects them into the use cases.

### Consequence

The system is more explicit, easier to test, and simpler to evolve.
