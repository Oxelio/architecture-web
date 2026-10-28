# Tests and verification

## Strategy

Tests are colocated with code and run with Vitest.

- Foundation tests domain primitives.
- IAM core tests entities, value objects, use cases, and its factory.
- Each adapter tests behavior and conversions for its technology.
- The API tests helpers and controllers with non-trivial access or mapping.
- IAM security tests cover policy snapshots, recovery, MFA, configuration administration, export failures, HTTP ownership, and Node cryptographic/archive adapters.
- The web has targeted unit tests; no E2E suite is declared.

A use case **MUST** be tested without real infrastructure through port doubles.
An adapter **SHOULD** test technology-specific behavior and invalid data. A
non-trivial HTTP mapping or authorization change **SHOULD** have an API test.

For paginated reads, distribute evidence by responsibility: core tests defaults,
bounds, authorization, and metadata; the adapter tests filters, count, order,
and `limit`/`offset`; the API tests the public envelope; the web tests criterion
serialization. Current Kysely tests use query-builder doubles and do not replace
PostgreSQL plan measurements on representative data.

PostgreSQL/Redis security integration tests are opt-in. They are skipped in ordinary unit runs unless both integration URLs are set. A skipped run does not validate concurrency or transaction guarantees. SMTP delivery, legal-retention completeness and deployment scheduling still require their own evidence.

## Root commands

```bash
pnpm build
pnpm typecheck
pnpm typecheck:test
pnpm lint
pnpm test
pnpm test:coverage
pnpm format:check
pnpm docs:links
pnpm docs:links:test
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

Run `pnpm docs:links` to validate repository-relative Markdown links in
`README.md`, `AGENTS.md`, and `docs/**/*.md`. The checker resolves targets from
the source document, removes query strings and fragments before checking file
existence, decodes URI paths, ignores external URLs and standalone anchors, and
fails when a target is missing or escapes the repository root. Anchor existence
itself is not validated.

The removed legacy `docs/method/` tree is explicitly rejected. References to the
adopted Software Engineering Method under `external/software-engineering-method/`
are checked against the initialized submodule and fail closed when that target is
unavailable.

Before local validation, initialize the Method submodule when needed:

```bash
git submodule update --init --recursive
pnpm docs:links
```

A CI job that executes `pnpm docs:links` MUST checkout the Method submodule first.
With `actions/checkout`, configure recursive submodule checkout or perform an
equivalent explicit initialization before running the command. This requirement
does not make GitHub Actions the validation authority.

Run `pnpm docs:links:test` for the controlled checker tests. They cover a valid
relative link, a nonexistent target, an explicitly forbidden `docs/method/`
regression, and a missing Method submodule target. The negative cases must return
validation errors, demonstrating fail-closed behavior without adding an external
service, credential, action, or runtime dependency.

## Coverage

Vitest uses V8 and writes text, HTML, and LCOV reports to each package's
`coverage` directory. No global minimum threshold is configured, so a
percentage cannot replace tests of important business behavior.

## Isolated IAM PostgreSQL/Redis integration

Use the dedicated disposable Compose project, which has no application volumes:

```powershell
docker compose -p iam-refactor-tests -f compose.iam-test.yml up -d --wait
$env:IAM_INTEGRATION_DATABASE_URL = 'postgresql://iam_test:iam_test@127.0.0.1:55432/iam_refactor_test'
$env:IAM_INTEGRATION_REDIS_URL = 'redis://127.0.0.1:56379/15'
pnpm --filter api test src/adapters/iam/iam-security.integration.spec.ts
docker compose -p iam-refactor-tests -f compose.iam-test.yml down
```

The database name must start with `iam_refactor_test`. Every run creates a unique schema, migrates it, and removes only that schema. Redis uses generated test-account/session identifiers and clears only those owned keys; it never flushes a database. Both variables are required together. These checks cover publication races, single-use recovery, outbox rollback, session-version protection after cleanup failure, MFA attempts and backup-code consumption, single archive download, last-administrator deletion and policy snapshot consistency.
