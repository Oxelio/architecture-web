# Architecture Web — Architecture principles

> **Content status:** Canonical
>
> **Document type:** Architecture Principles
>
> **Domain:** Architecture

These are **Architecture Web project constraints**. Generic delivery, artifact
ownership, context, readiness, review, and validation rules are owned by the
[Software Engineering Method](../method/README.md).

## 1. Bounded contexts are autonomous

A bounded context owns its model and vocabulary. Domain models are not shared
across contexts merely to reduce duplication. Cross-context interaction uses
explicit contracts and integration mechanisms.

## 2. Dependency direction points inward

Domain code must not depend on application orchestration or infrastructure.
Application code may depend on the domain and on ports it owns, but not on
concrete adapters. Infrastructure depends on the contracts it implements.
Composition is allowed to know concrete implementations.

See [Dependency rules](../architecture/dependency-rules.md).

## 3. Domain rules remain technology-independent

Database, cache, hashing, messaging, email, HTTP, UI, and framework concerns
must not become domain rules unless the business concept genuinely depends on
them.

## 4. Ports exist for a reason

A port represents an application-required capability at an architectural
boundary. Do not create ports mechanically for every dependency. Keep a port
coherent with the use cases and evolution cycle that drive it.

## 5. Aggregates protect consistency boundaries

Aggregate boundaries follow business consistency needs, not persistence tables
or endpoint shapes. Cross-aggregate coordination belongs to application
orchestration and explicit transaction capabilities.

## 6. Contracts are explicit

Application contracts use business language. Transport contracts belong to the
transport adapter. Infrastructure-specific types must not leak into domain or
application APIs.

## 7. Expected failures are modeled; unexpected failures remain failures

Expected business outcomes use explicit result/error contracts. Database,
network, programming, or other unexpected failures must not be disguised as
business errors without an explicit policy.

## 8. Project architecture is applied deliberately

DDD, Clean Architecture, Hexagonal Architecture, SOLID principles, and explicit
bounded contexts are Architecture Web choices. Apply them to preserve meaningful
boundaries and maintainability, not to maximize pattern or abstraction count.

Historical exceptions do not become preferred architecture merely because they
exist in nearby code.
