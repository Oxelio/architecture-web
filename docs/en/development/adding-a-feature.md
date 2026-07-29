# Adding a feature

This path starts from a business intent and ends at the interface. Not every
step is mandatory: create a port or domain object only when the feature needs
one.

This path describes the preferred structure in `packages/iam/core` and
`apps/api/src/features/iam`. The existing `apps/api/src/security` vertical is a
documented hybrid exception in the
[security guide](../guides/account-security.md); it **MUST NOT** become an
implicit template for a new capability.

## 1. Define behavior

Identify the actor and access level, business input and output, expected errors,
domain invariants, external effects, and possible breaking changes. Do not
start with the HTTP route: the application contract must remain usable from
another interface.

## 2. Extend the domain when needed

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

Export it from `packages/iam/core/domain/index.ts` only when it belongs to
the public contract. Add colocated tests for validation and meaningful limits.

## 3. Define the application contract

First choose `accounts`, `authentication`, or `access-administration`, then
create under `application/<capability>/use-cases/<feature>`:

- `<feature>.codes.ts` for stable codes;
- `<feature>.contracts.ts` for input, output, and interface;
- `<feature>.use-case.ts` for orchestration;
- `<feature>.use-case.spec.ts` for behavior.

The use case **MUST** depend on ports, never adapters.

Application contracts use business language. A paginated list names `users`
and `pagination`, for example; transport conventions such as `data` and `meta`
remain in the HTTP presenter.

## 4. Add or extend a port

Repositories belong in `application/repositories`; external services belong in
`application/services`. Keep ports coherent and driven by use-case needs. Do
not create a one-method port when the same adapter and evolution cycle already
cover that responsibility.

```ts
export abstract class ExampleRepository {
  abstract save(entity: ExampleEntity): Promise<void>;
}
```

Export the port from `application/index.ts`. A port change must update all
adapters, composition, and test doubles in the same change.

## 5. Implement infrastructure

Choose or create a specialized package. The adapter explicitly implements the
port:

```ts
export class TechnologyExampleAdapter implements ExampleRepository {
  async save(entity: ExampleEntity): Promise<void> {
    // mapping and technical call
  }
}
```

Export only necessary elements. Persistence schema, migrations, and mappers
change together.

## 6. Compose the use case

Add the dependency to `IamDependencies`, construct the use case in
`createIam`, expose it in `IamApplication`, and select the adapter in
`apps/api/src/composition-root/iam.module.ts`.

## 7. Expose HTTP

Create `apps/api/src/features/iam/<feature>` with controller, HTTP
contract, presenter, and TypeBox route options. Add the controller to
`compose-controllers.ts`, then register the route in `public.routes.ts`,
`protected.routes.ts`, or `admin.routes.ts`.

User routes derive identity from `request.auth`. Administrator routes retain
the role hook and forbid self-operations where the business rule requires it.

## 8. Adapt web and documentation

Update `apps/web/src/services/api.ts`, React Query hooks, UI, and FR/EN
translations. Web transport types match serialized responses, not domain
classes.

A parameterized query **MUST** include every criterion in its React Query key.
A mutation **MUST** invalidate every affected resource: a role change, for
example, invalidates both the paginated list and global indicators.

Update the HTTP reference for a new endpoint. Add an ADR only for a durable
structural decision.

A new route **MUST** define TypeBox schemas for its body, parameters, query,
and responses. Current security routes do not yet have them; that debt does not
justify another undocumented route.

## 9. Verify

Run tests and typechecks for affected units. A new port or public export
requires full-workspace validation and a search for internal imports that
bypass the public API.
