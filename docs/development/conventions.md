# Development conventions

## Naming and organization

- TypeScript files use kebab-case and a role suffix:
  `sign-in.use-case.ts`, `user.entity.ts`, `redis-session.adapter.ts`.
- Classes use PascalCase; functions and properties use camelCase.
- A use case exposes an explicit application contract and a use-case
  implementation.
- Group callable application operations by capability and then by business
  action, for example `authentication/begin-mfa-enrollment/`. Use
  `<action>.contracts.ts` and `<action>.use-case.ts`; export the action interface
  separately from its `<Action>UseCase` implementation. Composition returns
  application interfaces rather than inferred concrete classes.
- Name application input, outcome, and expected failure types `<Action>Input`,
  `<Action>Output`, and `<Action>Error`. An output that models expected failures
  uses `Result<Value, Error>`; a no-value success uses `void`. A named successful
  payload uses business vocabulary rather than another `Result` suffix.
- Name catalogs of error objects `<Action>Errors`. Keep a small catalog with its
  contract; extract `<action>.errors.ts` when the catalog warrants a separate
  module. `.codes.ts`, `ErrorCodes`, and `ErrorsCodes` are not preferred names
  for catalogs containing `{ code: ... }` objects.
- Technical implementations end in `Adapter` and name their technology when
  that distinction is useful.
- Tests are colocated as `*.spec.ts` or `*.spec.tsx`.
- IAM HTTP features following the preferred architecture have a folder under
  `apps/api/src/features/iam/<feature>`. Security operations follow the same application/adapter separation and group their HTTP controllers under the IAM security feature.

## Contracts and results

Expected business errors **MUST** be values with a stable code returned through
an explicit application result contract. Application contracts carry no HTTP
status. The API maps business outcomes to transport semantics.

Codes use a lowercase semantic namespace and a snake-case reason, such as
`authentication.invalid_credentials`, `mfa.invalid_challenge`, or
`account_export.disabled`. Prefer a capability-specific reason to a generic
`feature.disabled` or `token.invalid`. Different operations may expose the same
code when the meaning is the same.

Each fallible operation declares a closed union of expected errors, including
errors propagated from shared application checks or the domain. Do not widen an
application error contract to `{ code: string }`. Error factories must preserve
literal code types, including when returning metadata such as `actual` and `max`.
Read-only evaluations returning a list of validation codes use the same closed
vocabulary.

HTTP preserves application error codes and chooses the appropriate status and
response shape. Its typed mapping must cover the operation's error union and
must not rename codes to a parallel uppercase vocabulary. Schema-validation
errors belong to the transport boundary; unexpected server failures use
`internal.unexpected_error` without exposing internal details.

Unexpected database, cache, network, or programming failures **MUST NOT** be
invented as business errors. They remain technical failures unless an explicit
adapter or resilience policy maps them differently.

Transport response codes and shapes belong to the HTTP contract and must remain
synchronized with executable TypeBox schemas and consuming clients.

## Domain objects

- External values **MUST** pass through value-object factories when a semantic
  value object owns validation or invariants.
- `create` **MUST** establish invariants for new state.
- `rehydrate` **MUST** only restore persisted state that is already valid.
- Business transitions **SHOULD** be entity/aggregate behavior, not controller
  or adapter mutations.
- Ports **MUST NOT** replace existing semantic domain objects with primitives
  solely for technical convenience.
- Aggregate boundaries follow business consistency needs, not table or route
  structure.

## Ports and adapters

- A use case **MUST NOT** depend on concrete infrastructure.
- A port belongs to the application side of the boundary it represents.
- Infrastructure implements the public port contract and preserves semantics,
  not only TypeScript signatures.
- Do not create ports mechanically when there is no meaningful boundary.
- Concrete implementation selection belongs to composition.

See [Dependency rules](../architecture/dependency-rules.md).

## Imports and exports

A package public API **MUST** be deliberate and declared by index files and
`exports`. Consumers use documented public package subpaths, never private core
files.

Within a package, prefer declared `#...` aliases. New aliases must work for both
TypeScript and ESM output. Type-only imports should use `import type`.

With strict options such as `exactOptionalPropertyTypes`, omit an optional key
instead of explicitly assigning `undefined`:

```ts
return {
  userId,
  ...(client ? { client } : {}),
};
```

## HTTP interface

- Public, authenticated, and administrator routes stay separated.
- User-owned routes **MUST** derive `userId` from authenticated context and
  **MUST NOT** accept another owner from the client.
- Protected controllers **MUST** guard missing auth even behind a hook.
- New routes **MUST** describe body, params, query, and responses with TypeBox
  where applicable.
- Session cookies remain `httpOnly`; `sameSite` and `secure` are centralized in
  the existing cookie policy.

## Documentation and delivery

Repository documentation is canonical in English; user-facing localization may
remain multilingual. Generic ownership, lifecycle, role, readiness, review, and
validation rules are owned by the
[Software Engineering Method](../../external/software-engineering-method/README.md). Architecture Web binds them
through the [Project Method Profile](../project/project-method-profile.md).

Do not duplicate upstream Functional Specification, Technical Design, ADR, or
method rules in implementation notes merely for convenience.

## Commits and versions

Commitlint checks Conventional Commits using the locked workspace dependency.
Use coherent changes such as `feat(iam): ...` or `docs(architecture): ...`.
Squash PR titles must preserve the intended semantic impact; breaking changes
should use `!` or preserve their `BREAKING CHANGE` footer in the final commit.

The [delivery profile](../project/delivery-pipeline.md) owns version rules and
release authority. Use the [release guide](releases.md) for read-only planning,
first-stable requests and recovery. Published tags own versions; tracked
manifests are development declarations. Do not manually publish packages or
introduce independent versions as an implementation convenience.
