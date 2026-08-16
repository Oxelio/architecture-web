# Adding a feature

This guide applies the project delivery pipeline to feature implementation. It
starts from business intent and ends with review and validation.

Not every change needs every artifact. Use the full path for meaningful feature
work; keep small bugs and local maintenance proportional to their risk.

See [Delivery pipeline and artifacts](../project/delivery-pipeline.md).

## 1. Explore the problem when needed

Before designing code, establish the problem, actors, desired outcome, known
business rules, scope, alternatives, dependencies, and major risks.

Use an [Exploration](../project/templates/exploration.md) when uncertainty or
trade-offs are significant. Do not treat exploratory hypotheses as approved
behavior.

## 2. Define the Functional Specification

For a feature, the Functional Specification is the source of truth for expected
behavior. It describes the **what**, not the infrastructure.

Identify at least:

- actor and authorization expectations;
- business input and output;
- domain rules and invariants;
- states and significant transitions;
- expected errors and edge cases;
- functional dependencies;
- externally observable behavior;
- acceptance criteria;
- non-goals.

Do not start from a Fastify route, database table, React component, or adapter.
The same application behavior should remain meaningful from another interface.

Use the
[Functional Specification template](../project/templates/functional-specification.md)
for new substantial specifications.

## 3. Approve behavior before architecture

A feature enters `Approved` only after blocking functional questions are
resolved and the behavior is explicitly accepted for an identified scope.

A Functional Specification being detailed does not make it approved.

## 4. Produce Technical Design when architecture work is needed

The Technical Design translates approved behavior into the current
architecture. It may define bounded-context ownership, aggregates, application
use cases, ports, adapters, data flows, transactions, messaging, security,
migrations, performance constraints, and test strategy.

Use the [Technical Design template](../project/templates/technical-design.md).

If this work requires a durable structural decision with several reasonable
alternatives, create an [ADR](../architecture/decisions/README.md). Do not create
an ADR for routine local choices.

## 5. Reach Ready and create focused tasks

Before implementation starts, verify the Definition of Ready in the
[delivery pipeline](../project/delivery-pipeline.md).

Tasks are small execution units. They reference the Functional Specification,
Technical Design, and ADRs instead of duplicating them. Each task should define
an objective, relevant constraints, acceptance criteria, expected tests, and
non-goals when useful.

See the [Task template](../project/templates/task.md).

## 6. Extend the domain only when the feature needs it

A new value object follows existing factories:

```ts
export class ExampleValueObject extends ValueObject<{ value: string }> {
  static create(value: string): Result<ExampleValueObject, ExampleError> {
    if (!isValid(value)) {
      return Result.failure({ code: "example.invalid" });
    }
    return Result.success(new ExampleValueObject({ value }));
  }

  get value(): string {
    return this.properties.value;
  }
}
```

Export it from the bounded context's public domain API only when it belongs to
that public contract. Add colocated tests for validation and meaningful limits.

Aggregate boundaries follow business consistency, not database or endpoint
shape.

## 7. Define or extend the application contract

In the historical IAM core, choose the appropriate capability (`accounts`,
`authentication`, or `access-administration`) and create the use-case contract
and implementation under the corresponding application area.

Application contracts use business language. Transport conventions such as
`data`, `meta`, HTTP status, headers, and cookies remain at the transport
boundary.

Expected business outcomes use typed result/error contracts. Infrastructure
failures must not be disguised as business errors without an explicit policy.

## 8. Add or extend a port only at a real boundary

Repositories belong with application-owned persistence capabilities; external
services belong with the application capability that needs them. Keep ports
coherent and driven by use-case needs.

Do not mechanically create a one-method abstraction for every dependency when
no architectural boundary or alternative implementation is being protected.

A port change must update all adapters, composition, and test doubles in the
same change.

A PostgreSQL command that changes multiple aggregates **MUST** use the explicit
transaction capability (`IamUnitOfWork` in the current IAM architecture). An
operation spanning PostgreSQL and Redis must define idempotency and recovery
semantics rather than pretending to provide a distributed transaction.

## 9. Implement infrastructure

Choose or create a specialized adapter only when the approved design requires
it. An adapter implements the application-owned port and contains technical
mapping and provider behavior.

Persistence schema, migrations, and mappers change together. Rehydration must
not silently normalize invalid persisted state.

## 10. Compose the feature

Wire concrete adapters at the composition boundary. In the current API this
means the composition root, not controllers or application use cases.

The existing `apps/api/src/security` vertical is a documented historical
exception and **MUST NOT** become an implicit template for new capabilities.

## 11. Expose HTTP and UI

Create or update transport contracts, controllers/presenters, route schemas,
and UI clients without leaking domain entities across the boundary.

A new route **MUST** define TypeBox schemas for body, params, query, and
responses where applicable. User-owned routes derive identity from authenticated
context rather than accepting an arbitrary owner from the client.

For React Query, parameterized queries must include every criterion in the key,
and mutations must invalidate all affected resources.

Update product localization resources for every supported UI locale when user-
facing text changes. This localization requirement is independent from the
single-language repository documentation policy.

## 12. Review

Review the implementation from three independent perspectives:

1. **Code quality** — readability, maintainability, complexity, duplication,
   error handling, and tests;
2. **Architecture compliance** — bounded-context ownership, dependency
   direction, domain/application/infrastructure separation, ports/adapters,
   aggregate boundaries, and ADRs;
3. **Functional compliance** — behavior and acceptance criteria from the
   Functional Specification.

Use a durable [Review](../project/templates/review.md) document only when the
risk or significance justifies keeping one beyond normal pull-request history.

## 13. Validate

Run the smallest set of evidence that proves the required behavior at the right
boundaries: domain/application tests, adapter tests, integration/contract tests,
end-to-end or acceptance tests, and security/migration/performance checks when
needed.

See [Testing and verification](testing.md) and the optional
[Validation Report template](../project/templates/validation-report.md).

## 14. Finish by synchronizing owners

Before `Done`, ensure the Functional Specification, Technical Design, ADRs,
architecture references, HTTP reference, and guides that own changed facts
reflect the behavior that actually remains in the repository.

Do not preserve obsolete documentation as `old` files; Git is the history.
