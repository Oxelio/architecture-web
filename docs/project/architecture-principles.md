# Architecture Web — Architecture principles

> **Lifecycle:** Approved
>
> **Content status:** Canonical
>
> **Document type:** Architecture Principles
>
> **Domain:** Architecture

## 1. Business intent before implementation

Start from the problem, actor, behavior, invariants, and acceptance criteria.
HTTP routes, database schemas, queues, caches, and UI components are technical
consequences, not the definition of the feature.

## 2. Bounded contexts are autonomous

A bounded context owns its model and vocabulary. Domain models are not shared
across contexts merely to reduce duplication. Cross-context interaction uses
explicit contracts and integration mechanisms.

## 3. Dependency direction points inward

Domain code must not depend on application orchestration or infrastructure.
Application code may depend on the domain and on ports it owns, but not on
concrete adapters. Infrastructure depends on the contracts it implements.
Composition is allowed to know concrete implementations.

See [Dependency rules](../architecture/dependency-rules.md).

## 4. Domain rules remain technology-independent

Database, cache, hashing, messaging, email, HTTP, and UI concerns must not
become domain rules unless the business concept genuinely depends on them.

## 5. Ports exist for a reason

A port represents an application-required capability at an architectural
boundary. Do not create ports mechanically for every dependency. Keep a port
coherent with the use cases and evolution cycle that drive it.

## 6. Aggregates protect consistency boundaries

Aggregate boundaries follow business consistency needs, not persistence tables
or endpoint shapes. Cross-aggregate coordination belongs to application
orchestration and explicit transaction capabilities.

## 7. Contracts are explicit

Application contracts use business language. Transport contracts belong to the
transport adapter. Infrastructure-specific types must not leak into domain or
application APIs.

## 8. Expected failures are modeled; unexpected failures remain failures

Expected business outcomes use explicit result/error contracts. Database,
network, programming, or other unexpected failures must not be disguised as
business errors without an explicit policy.

## 9. Prefer simple, local designs

Introduce abstractions, factories, services, repositories, events, or generic
frameworks only when they solve a concrete problem. Maintainability includes
being able to remove or change code without first understanding unnecessary
indirection.

## 10. Decisions and implementation stay synchronized

A Functional Specification owns approved feature behavior. A Technical Design
owns the architecture of a specific approved feature. An ADR records why a
durable structural architecture decision was made. Implementation must not
silently redefine any of them.

## 11. Tests provide evidence at the right boundary

Prefer domain and application tests for business behavior, adapter tests for
technical semantics, contract/integration tests for boundaries, and end-to-end
or acceptance tests only where cross-system evidence is needed.

## 12. Git is the history

Current documents describe current truth. Do not create `old`, `v2`, backup,
or parallel-language copies to preserve history; use Git commits and tags.
