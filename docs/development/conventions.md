# Development conventions

## Naming and organization

- TypeScript files use kebab-case and a role suffix:
  `sign-in.use-case.ts`, `user.entity.ts`, `redis-session.adapter.ts`.
- Classes use PascalCase; functions and properties use camelCase.
- A use case exposes an explicit application contract and a use-case
  implementation.
- Technical implementations end in `Adapter` and name their technology when
  that distinction is useful.
- Tests are colocated as `*.spec.ts` or `*.spec.tsx`.
- IAM HTTP features following the preferred architecture have a folder under
  `apps/api/src/features/iam/<feature>`. The current security vertical is an
  observed historical exception, not an implicit template for new features.

## Contracts and results

Expected business errors **MUST** be values with a stable code returned through
an explicit application result contract. Application contracts carry no HTTP
status. The API maps business outcomes to transport semantics.

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
[Software Engineering Method](../method/README.md). Architecture Web binds them
through the [Project Method Profile](../project/project-method-profile.md).

Do not duplicate upstream Functional Specification, Technical Design, ADR, or
method rules in implementation notes merely for convenience.

## Commits and versions

Commitlint enforces Conventional Commits. Changes **SHOULD** form coherent units
such as `feat(iam): ...` or `docs(architecture): ...`.

Manifest alpha versions do not establish a publication policy. Without
repository automation or an accepted ADR, do not claim that Semantic Release,
independent versioning, or inter-package SemVer guarantees are active.
