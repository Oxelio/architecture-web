# Development conventions

## Naming and organization

- TypeScript files use kebab-case and a role suffix:
  `sign-in.use-case.ts`, `user.entity.ts`, `redis-session.adapter.ts`.
- Classes use PascalCase; functions and properties use camelCase.
- A use case exposes a `Name` contract, `NameInput`, `NameOutput`, optionally
  `NameError`, and a `NameUseCase` implementation.
- Technical implementations end in `Adapter` and name their technology.
- Tests are colocated as `*.spec.ts` or `*.spec.tsx`.
- IAM HTTP features following the historical architecture have a folder under
  `apps/api/src/features/iam/<feature>`. The current security vertical is
  grouped under `apps/api/src/security`; this observed exception is not an
  implicit template for new features.

## Contracts and results

In the IAM core, expected business errors **MUST** be values with a stable
`code`, returned through `Result<TValue, TError>`. Application contracts carry
no HTTP status. The API maps codes in `*.http.ts`, and presenters map results
to transport. The security vertical currently uses `SecurityError` and maps it
directly in its routes; this is a documented divergence, not a new general
rule.

Unexpected database, cache, or programming failures **MUST NOT** be invented as
business errors. They reach the global API handler unless an explicit adapter
strategy applies.

Success codes are local to HTTP contracts. A response code, status, or shape
change **MUST** update its TypeBox schema and web client.

## Domain objects

- External values **MUST** pass through value-object factories.
- `create` **MUST** establish invariants for new state.
- `rehydrate` **MUST** only restore persisted state.
- Business transitions **SHOULD** be entity methods, not controller or adapter
  mutations.
- Ports **MUST NOT** replace existing semantic value objects with primitives.

## Imports and exports

A package public API **MUST** be deliberate and declared by index files and
`exports`. Consumers use `@architecture/iam/application` or `/domain`,
never internal paths.

Within a package, prefer declared `#...` aliases. New aliases **MUST** work for
TypeScript and ESM output. Type-only imports **SHOULD** use `import type`.

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
- User-owned routes **MUST** derive `userId` from `request.auth` and **MUST
  NOT** accept another owner from the client.
- Protected controllers **MUST** guard missing auth even behind a hook.
- Every new route **MUST** describe body, params, query, and responses with
  TypeBox. Routes in `apps/api/src/security/security.routes.ts` do not do this
  yet and therefore leave OpenAPI documentation debt.
- Session cookies remain `httpOnly`; `sameSite` and `secure` are centralized in
  `buildSessionCookieOptions`.

## Commits, documentation, and versions

Commitlint enforces Conventional Commits. Changes **SHOULD** form coherent units
such as `feat(iam): ...` or `docs(architecture): ...`.

Durable structural decisions **SHOULD** be recorded as ADRs. Any rule or
navigation change **MUST** update the French and English editions together.

Manifest alpha versions do not establish a publication policy. Without
automation or an ADR, do not claim that Semantic Release, independent
versioning, or inter-package SemVer guarantees are active.
