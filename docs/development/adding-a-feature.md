# Adding a feature in Architecture Web

This guide applies the generic [Software Engineering Method](../../external/software-engineering-method/README.md)
to Architecture Web's concrete DDD/Clean/Hexagonal implementation.

For Work Type, Workflow Depth, lifecycle, roles, Context Manifest, Readiness,
Working Decision Log, Review, and Validation semantics, use the generic method.
Resolve project owners through the
[Project Method Profile](../project/project-method-profile.md).

## 1. Classify and resolve context before implementation

A new product behavior normally uses `Product Behavior Change`; an established
bug uses `Defect Correction`. Security, migration, compatibility, concurrency,
and similar concerns are Change Characteristics that may increase Workflow
Depth and required review/validation.

For meaningful work, build a focused Context Manifest before making normative
decisions. Do not load unrelated bounded contexts or use nearby historical code
as an architectural owner.

## 2. Functional behavior belongs in a Functional Specification

When new or changed product behavior must become authoritative, use the
[Functional Specification template](../project/templates/functional-specification.md).
Keep HTTP routes, database schemas, React components, Redis, concrete adapters,
and framework APIs out of the functional owner unless they are genuine product
constraints.

Human Functional Approval is required before proposed behavior becomes
`Approved`. AI may prepare or assess the specification but may not cross that
gate automatically.

A defect restoring already-established behavior does not need a new Functional
Specification merely to re-approve the same rule.

## 3. Apply Architecture Web Technical Design when triggered

When the work needs non-trivial design before coding, use the
[Technical Design template](../project/templates/technical-design.md) after the
relevant product behavior is approved.

Architecture Web Technical Design should evaluate, as relevant:

- bounded-context ownership;
- aggregates and consistency boundaries;
- application use cases and orchestration;
- application-owned ports and external capabilities;
- adapter and composition responsibilities;
- state/persistence and data flow;
- transactions, concurrency, idempotency, and messaging;
- security/privacy;
- migration/compatibility;
- performance/operations;
- technical error semantics;
- validation strategy.

Create an [ADR](../architecture/decisions/README.md) only when the generic ADR
trigger applies: a durable structural decision has meaningful alternatives and
its rationale is worth preserving.

## 4. Plan Tasks before formal Readiness Review

Tasks reference their Functional Specification, Technical Design, and relevant
ADRs instead of copying them. Use the
[Task template](../project/templates/task.md) for work that benefits from
explicit delegation/sequencing.

For Standard/Complex implementation, perform Task Planning before the formal
[Readiness Review](../../external/software-engineering-method/readiness-review.md). Do not enter `Ready` while a
Task requires the Developer to decide unresolved product or structural
architecture questions.

## 5. Extend the domain only when the feature needs it

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

## 6. Define or extend the application contract

In the historical IAM core, choose the appropriate capability (`accounts`,
`authentication`, or `access-administration`) and create the use-case contract
and implementation under the corresponding application area.

Application contracts use business language. Transport conventions such as
`data`, `meta`, HTTP status, headers, and cookies remain at the transport
boundary.

Use one action directory with `<action>.contracts.ts` and
`<action>.use-case.ts`. The contract defines the action interface and its input,
output, and expected errors; small `<Action>Errors` catalogs can stay there.
Extract `<action>.errors.ts` when that improves readability. Follow the
[error and naming conventions](conventions.md) rather than creating a fixed
number of files for every action.

Expected business outcomes use typed result/error contracts. Infrastructure
failures must not be disguised as business errors without an explicit policy.

## 7. Add or extend a port only at a real boundary

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

## 8. Implement infrastructure

Choose or create a specialized adapter only when the approved design requires
it. An adapter implements the application-owned port and contains technical
mapping and provider behavior.

Persistence schema, migrations, and mappers change together. Rehydration must
not silently normalize invalid persisted state.

## 9. Compose the feature

Wire concrete adapters at the composition boundary. In the current API this
means the composition root, not controllers or application use cases.

IAM security operations follow this same boundary. Their Node and cross-context implementations live in `apps/api/src/adapters/iam`; their application use cases live in the IAM context.

## 10. Expose HTTP and UI

Create or update transport contracts, controllers/presenters, route schemas,
and UI clients without leaking domain entities across the boundary.

Preserve the application error vocabulary in HTTP mappings and update client
code comparisons whenever an error code changes. Mappings are exhaustive for
the declared application errors; unexpected failures remain technical failures.

A new route **MUST** define TypeBox schemas for body, params, query, and
responses where applicable. User-owned routes derive identity from authenticated
context rather than accepting an arbitrary owner from the client.

For React Query, parameterized queries must include every criterion in the key,
and mutations must invalidate all affected resources.

Update product localization resources for every supported UI locale when
user-facing text changes. This localization requirement is independent from the
single-language repository documentation policy.

## 11. Review using independent perspectives

Use the generic [Review and validation](../../external/software-engineering-method/review-validation.md) model.
Architecture Web adds these Architecture Review concerns when applicable:

- bounded-context ownership;
- dependency direction;
- domain/application/infrastructure separation;
- ports/adapters;
- aggregate and transaction boundaries;
- public package/contracts;
- applicable ADRs.

Use a durable [Review template](../project/templates/review.md) only when the
risk or significance justifies keeping a record beyond pull-request history.

## 12. Validate proportionally

Follow [Testing and verification](testing.md) and the method's evidence model.
Use the smallest sufficient set of domain/application, adapter, integration,
contract, E2E/acceptance, security, migration, compatibility, or performance
evidence for the changed boundaries.

Use a [Validation Report](../project/templates/validation-report.md) when durable
validation evidence adds value.

## 13. Finish by synchronizing owners

Before `Done`:

- resolve all Working Decisions for the completed scope;
- ensure approved-target owners contain accepted target behavior/design;
- ensure current-state architecture/reference documents describe what is
  actually effective, not merely what was decided for the future;
- ensure implementation and validation evidence no longer conflicts silently
  with canonical owners.

Do not preserve obsolete documentation as `old` files; Git is the history.
