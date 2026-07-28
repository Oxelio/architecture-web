# Dependency rules

**MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

## Allowed direction

```mermaid
flowchart TD
    Web[apps/web] --> HTTP[apps/api - HTTP contract]
    HTTP --> App[identity/application]
    App --> Domain[identity/domain]
    Domain --> Foundation[foundation]
    App --> Foundation
    Infra[identity/infrastructure] --> App
    Infra --> Domain
    Composition[apps/api/composition-root] --> Infra
    Composition --> App
```

An arrow means “may depend on”; it does not require the dependency.

## Matrix

| From                    | May import                                   | Must not import                             |
| ----------------------- | -------------------------------------------- | ------------------------------------------- |
| Foundation              | required generic libraries                   | Identity, apps, infrastructure              |
| Identity domain         | Foundation, Identity domain                  | application, infrastructure, Fastify, React |
| Identity application    | Identity domain, Foundation, local ports     | adapters, database, cache, HTTP, UI         |
| Identity infrastructure | public Identity exports, targeted technology | private core internals, apps                |
| API outside composition | application contracts, Fastify, API helpers  | domain internals, concrete adapters         |
| API composition root    | application and concrete adapters            | —                                           |
| Web                     | UI code and HTTP contract                    | business and infrastructure packages        |

## Direct answers

- An entity **MUST NOT** import a use case.
- A use case **MUST NOT** depend on Redis or Kysely.
- Infrastructure **MUST** depend on the application port it implements.
- Business types shared by domain and application belong to the domain.
- Generic, truly cross-domain types **MAY** belong to Foundation.
- HTTP DTOs belong to `apps/api`; matching client types belong to `apps/web`.
- Business packages **MAY** depend on Foundation, but applications and adapters
  **SHOULD** prefer a closer contract when one exists.

## Exports and imports

External consumers **MUST** use exported subpaths:

```ts
import type { SignIn } from "@architecture/identity/application";
import { EmailValueObject } from "@architecture/identity/domain";
```

They **MUST NOT** import files inside
`packages/identity/core/application/use-cases`. Within a package, declared
`#...` aliases **SHOULD** replace `../` parent imports. The current ESLint rule
reports parent imports as warnings.

Internal core aliases omit `.js`; relative imports intended for ESM output
generally include `.js`.

## Port compatibility

An implementation **MUST**:

1. depend on the public port;
2. declare `implements Port`;
3. preserve semantics as well as the signature;
4. test important behavior and technical errors;
5. be selected only in the composition root.

Adding a required method, changing parameters, return values, or semantics is a
breaking port change. Every adapter and test double **MUST** change together.
Adding a required contract field, removing a code, or changing its meaning is
also breaking.

## Current enforcement and limitation

pnpm packages, `exports`, and TypeScript types materialize boundaries. ESLint
does not yet forbid every dependency direction, so this matrix remains
normative even when tooling does not block a violation.
