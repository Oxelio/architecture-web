# Tests and verification

## Strategy

Tests are colocated with code and run with Vitest.

- Foundation tests domain primitives.
- IAM core tests entities, value objects, use cases, and its factory.
- Each adapter tests behavior and conversions for its technology.
- The API tests helpers and controllers with non-trivial access or mapping.
- The security module currently tests configuration validation, redaction,
  TOTP, and ZIP-building primitives.
- The web has targeted unit tests; no E2E suite is declared.

A use case **MUST** be tested without real infrastructure through port doubles.
An adapter **SHOULD** test technology-specific behavior and invalid data. A
non-trivial HTTP mapping or authorization change **SHOULD** have an API test.

For paginated reads, distribute evidence by responsibility: core tests defaults,
bounds, authorization, and metadata; the adapter tests filters, count, order,
and `limit`/`offset`; the API tests the public envelope; the web tests criterion
serialization. Current Kysely tests use query-builder doubles and do not replace
PostgreSQL plan measurements on representative data.

Recovery, MFA, export, deletion, retention, and dynamic-publication
transactions have no automated integration suite spanning PostgreSQL, Redis,
and SMTP. Primitive tests in `security.service.spec.ts` therefore do not prove
every concurrent scenario from the security specifications.

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

## Human-supplied validation evidence

For the current human-directed delivery model, a human validator executes and
supplies pre-merge validation evidence. GitHub Actions may provide supplementary
check results, but it is not the validation authority and MUST NOT be required
merely to regenerate evidence after every pushed Pull Request HEAD.

Human-supplied validation evidence SHOULD record:

- the human validator identity;
- the exact candidate commit SHA and relevant Pull Request or ref;
- the commands or checks executed;
- the result of each command or check;
- environment or tooling notes when they materially affect interpretation.

Validation evidence is candidate-bound. Evidence for one commit SHA does not
implicitly validate a later candidate SHA. When the candidate changes, rerun the
checks whose evidence could have been invalidated by that change, proportional
to the affected boundaries and risks. Before merge, confirm that accepted
validation evidence applies to the current candidate SHA.

A future automated evidence mechanism may replace or reduce this human execution
only after separate accepted project scope establishes its semantics and
activation. Automated check success by itself does not establish validation
sufficiency.

## Markdown links

No dedicated link-checking script is versioned in the repository. During a documentation audit, validate every relative Markdown link against
its target in the canonical `docs/` tree. There are no parallel language trees
to mirror. A local checker should resolve links from the source document,
remove fragments when checking file existence, decode paths, and ignore
external URLs and standalone anchors. Anchors need a separate check when
critical.

No dedicated documentation-link checker is currently part of the repository or
CI. Adding one is a recommendation, not a current guarantee.

## Coverage

Vitest uses V8 and writes text, HTML, and LCOV reports to each package's
`coverage` directory. No global minimum threshold is configured, so a
percentage cannot replace tests of important business behavior.
