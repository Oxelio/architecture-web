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

The [repository CI](continuous-integration.md) supplies both integration URLs to
disposable services for its primary PR/post-merge suite and release validation.
The Node 24 compatibility job runs unit tests without these services. Successful
primary/release runs therefore provide the existing database-boundary evidence;
skipped local/compatibility runs still do not.

## Root commands

```bash
pnpm build
pnpm typecheck
pnpm typecheck:test
pnpm lint
pnpm test
pnpm test:coverage
pnpm ci:test
pnpm ci:test:integration
pnpm ci:test:tooling
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

### Isolated Messaging unit tests

Messaging's Vitest configuration resolves its internal `#...` aliases to `src`,
following the IAM package convention. Its unit tests do not require Messaging's
own `dist` output. Excluding `dist` from test discovery alone does not prevent an
import from loading stale compiled code.

Public imports from other workspace packages still use their compiled exports.
Build those dependencies from the current candidate before an isolated run:

```bash
pnpm --filter '@architecture/messaging^...' build
pnpm --filter @architecture/messaging test
```

Workspace and API integration tests consume public compiled package exports;
run `pnpm build` first so those outputs represent the candidate under validation.
Outbox and notification delivery attempts count successful claims, including
abandoned claims, rather than only recorded failures. New items start at zero;
success/failure finalization does not increment the count. The tenth failed or
abandoned attempt reaches `dead_letter`.

## Proportional verification

Documentation-only changes should validate relative links and referenced paths,
run Prettier or `format:check`, and run `git diff --check`.

A business change should run core tests, typechecks for affected packages,
adapter tests, and consuming app tests/lint/build. A changed port or public
export warrants full-workspace validation.

## Candidate-bound validation evidence

Under the maintainer-accepted Work #58 policy, automated validation is sufficient
pre-merge evidence when it covers the changed boundaries and risks. A human
validator does not have to rerun successful automated checks. This authority is
established by project policy, not by the existence of a green check alone.

Validation evidence MUST record:

- the workflow/run identity or human validator identity;
- the exact candidate commit SHA and relevant Pull Request or ref;
- the commands or checks executed;
- the result of each command or check;
- environment or tooling notes when they materially affect interpretation.

Validation evidence is candidate-bound. Evidence for one commit SHA does not
implicitly validate a later candidate SHA. When the candidate changes, rerun the
checks whose evidence could have been invalidated by that change, proportional
to the affected boundaries and risks. Before merge, confirm that accepted
validation evidence applies to the current candidate SHA.

The repository validation workflow supplies build, application and test
typechecks, lint, tests, formatting, documentation-link checks and checker tests.
Accept its successful result only for the current candidate SHA, with a run URL
and the executed commands/results available in the logs. Failed, cancelled,
missing or stale results are insufficient. Skipped optional integration tests
provide no evidence for their boundaries; changes requiring database or other
external-system validation still need that evidence, automated or human.

The responsible review and validation activities assess scope and unresolved
findings before the Work Merge Gate records validation sufficiency. Automation
does not supply product/governance approvals, accept reviews, grant merge
authority, establish Project Status or imply Work completion. These remain
governed by the [delivery profile](../project/delivery-pipeline.md).

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
equivalent explicit initialization before running the command.

Run `pnpm docs:links:test` for the controlled checker tests. They cover a valid
relative link, a nonexistent target, an explicitly forbidden `docs/method/`
regression, and a missing Method submodule target. The negative cases must return
validation errors, demonstrating fail-closed behavior without adding an external
service, credential, action, or runtime dependency.

## Coverage

Vitest uses V8 and writes text, HTML, and LCOV reports to each package's
`coverage` directory. No global minimum threshold is configured, so a
percentage cannot replace tests of important business behavior.

`pnpm ci:test` runs all declared test workspaces with coverage and a result
summary, rejecting missing coverage commands, execution reports and zero tests.
It clears generated reports before execution. `pnpm ci:test:integration` uses the
same runner with the disposable PostgreSQL/Redis environment, including cleanup
on failure. Run these commands through pnpm so child commands use its exact CLI.

Run `pnpm ci:test:tooling` after workspace coverage and before
`node scripts/merge-coverage.mjs`. The native Node test runner collects V8
coverage and emits `coverage/scripts/lcov.info`, including tested CLI child
processes. Both supported Node lines exercise this collection. The merger
combines that repository-relative report with all workspace reports to prepare
`coverage/lcov.info`. A valid nonempty LCOV report is required from every expected
test workspace and all four expected CI-script sources; partial coverage,
malformed records/counters, duplicate sources and missing/escaping sources are
rejected. Workspace execution counts and native coverage are separate evidence:
passing tests alone do not establish coverage import. `pnpm ci:test:tooling` verifies runner/service failures, required
check outcomes and coverage handling. The [CI guide](continuous-integration.md)
describes shared validation and same-run artifact transfer. The Actions job
`SonarQube (informational)` retains `continue-on-error: true`; the separate external
`SonarCloud Code Analysis` check is required for merge into `main` under the
[delivery profile](../project/delivery-pipeline.md#required-checks-on-main).
Verify the current candidate's external result as well as `Quality checks`;
a tolerated job failure, skipped analysis or missing result does not satisfy
that merge requirement. The CI guide documents failure handling and the current
fork/Dependabot analysis limitation. These checks do not replace the Work Merge
Gate or applicable review and authority gates.

## Isolated IAM PostgreSQL/Redis integration

Use the dedicated disposable Compose project, which has no application volumes:

```powershell
docker compose -p iam-refactor-tests -f compose.iam-test.yml up -d --wait
$env:IAM_INTEGRATION_DATABASE_URL = 'postgresql://iam_test:iam_test@127.0.0.1:55432/iam_refactor_test'
$env:IAM_INTEGRATION_REDIS_URL = 'redis://127.0.0.1:56379/15'
pnpm --filter api test src/adapters/iam/iam-security.integration.spec.ts src/adapters/iam/iam-events.integration.spec.ts
docker compose -p iam-refactor-tests -f compose.iam-test.yml down
```

The database name must start with `iam_refactor_test`. Every run creates a unique schema, migrates it, and removes only that schema. Redis uses generated test-account/session identifiers and clears only those owned keys; it never flushes a database. Both variables are required together. These checks cover publication races, single-use recovery, outbox rollback, session-version protection after cleanup failure, MFA attempts and backup-code consumption, single archive download, last-administrator deletion and policy snapshot consistency.

The IAM correction extends the isolated suite with stale credential saves (including MFA), identity-bound recovery issuance in both orderings, stale MFA generations, unsafe publication/restoration, mixed administrator mutations, a real pre-refactor database upgrade, and publication inside actual registration/sign-in workflows. Fixtures use only their generated schemas and owned Redis keys. These scenarios must execute with both integration URLs; ordinary skipped runs provide no database evidence.

The event suite uses a separate generated PostgreSQL schema to exercise real
`SKIP LOCKED` behavior, distinct concurrent claims, expired/replaced-owner
finalization in both success/failure orderings, ten abandoned attempts,
independent notification channel updates, acknowledgement/archive preservation,
concurrent replay, partial Audit/Notifications dispatch, version rejection and
aggregate/outbox rollback followed by fresh-state retry. It never resets an
application schema. Both integration URLs remain required by the isolated-suite
configuration; these event-specific cases use PostgreSQL, while the security
suite supplies the real Redis-boundary evidence.

## Automatic release verification

Release-boundary validation is automated under the accepted [delivery policy](../project/delivery-pipeline.md). Pre-merge Work validation may also use the sufficient candidate-bound automated evidence described above. The release suite checks Conventional Commit rules, first-stable authority, isolated release-it generation, deterministic source archives, a real temporary bare Git remote, partial publication and checksum conflicts. Run `pnpm --filter @architecture/delivery-automation test src/release` for the targeted suite. A passing fixture does not prove live GitHub activation.
