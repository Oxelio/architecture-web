# Tests and verification

## Strategy

Tests are colocated with code and run with Vitest.

- Foundation tests domain primitives.
- IAM core tests entities, value objects, use cases, and its factory.
- Each adapter tests behavior and conversions for its technology.
- The API tests helpers and controllers with non-trivial access or mapping.
- The web has targeted unit tests; no E2E suite is declared.

A use case **MUST** be tested without real infrastructure through port doubles.
An adapter **SHOULD** test technology-specific behavior and invalid data. A
non-trivial HTTP mapping or authorization change **SHOULD** have an API test.

For paginated reads, distribute evidence by responsibility: core tests defaults,
bounds, authorization, and metadata; the adapter tests filters, count, order,
and `limit`/`offset`; the API tests the public envelope; the web tests criterion
serialization. Current Kysely tests use query-builder doubles and do not replace
PostgreSQL plan measurements on representative data.

## Root commands

```bash
pnpm build
pnpm typecheck
pnpm typecheck:test
pnpm lint
pnpm test
pnpm test:coverage
pnpm format:check
```

For a shorter loop:

```bash
pnpm --filter @architecture/iam test
pnpm --filter api test
pnpm --filter web test
```

The core package is named `@architecture/iam`, not
`@architecture/iam-core`.

## Proportional verification

Documentation-only changes should validate relative links and referenced paths,
run Prettier or `format:check`, and run `git diff --check`.

A business change should run core tests, typechecks for affected packages,
adapter tests, and consuming app tests/lint/build. A changed port or public
export warrants full-workspace validation.

## Markdown links

No dedicated link-checking script exists yet. A local check must resolve each
relative link from its document, remove fragments, decode paths, and ignore
external URLs and standalone anchors. Anchors need a separate check when
critical.

This missing automation is a recommendation, not a current guarantee.

## Coverage

Vitest uses V8 and writes text, HTML, and LCOV reports to each package's
`coverage` directory. No global minimum threshold is configured, so a
percentage cannot replace tests of important business behavior.
