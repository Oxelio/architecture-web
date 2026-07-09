# Conventions and development rules

## Code organization

The code is organized around clear responsibilities:

- routes and controllers live in the web application,
- use cases live in the bounded context,
- entities and value objects live in the domain,
- concrete technical implementations live in infrastructure.

## Naming conventions

- files use descriptive lowercase kebab-case names,
- domain classes use business-oriented names,
- use cases end with the suffix “UseCase”,
- adapters use names that reflect the relevant technology.

## Architecture rules

- the domain must not depend on infrastructure,
- use cases should not know database or web framework details,
- external dependencies should go through ports and adapters,
- business errors should be explicit and not hidden behind generic exceptions.

## Error handling

Errors should be handled at the appropriate layer:

- business errors propagate to the use cases,
- the HTTP layer translates them into coherent responses,
- technical details should not leak into the domain.

## Testing strategy

The project already contains use-case-level tests. Tests should favor:

- validating business rules,
- isolating dependencies through doubles or ports,
- verifying observable behavior of the use case.

## Contribution process

When adding a feature:

1. identify the relevant bounded context,
2. add or modify the relevant use cases,
3. preserve the separation of responsibilities,
4. adapt the API if necessary,
5. add targeted tests.
