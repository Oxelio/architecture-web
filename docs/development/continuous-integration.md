# Continuous integration

The [delivery profile](../project/delivery-pipeline.md) owns branch policy,
permissions and gates. [Testing and verification](testing.md) owns validation
strategy and commands. CI does not establish review acceptance, Work State,
merge authority or Work completion.

## Entry points and shared validation

`delivery-automation-validation.yml` runs on all PRs into `main`, including drafts,
on pushes to `main`, and on manual dispatch. Editing a PR title also reruns CI.
Superseded PR runs are cancelled; main runs are not deliberately cancelled.

`repository-validation.yml` is the shared read-only workflow used by CI and release
validation. Its required inputs are `candidate_sha` (a full immutable commit SHA)
and `comparison_base` (a full SHA, or empty to use the candidate's first parent).
The checkout is verified against the input. A missing parent for a root commit
uses the empty tree. PRs supply their base SHA, pushes supply their previous SHA,
and manual/release calls use the first parent. Whitespace is checked over this
explicit range, rather than over an already-clean working tree.

The primary job uses `.nvmrc` (Node 26) and the exact pnpm `packageManager` version.
It installs the frozen lockfile, builds, previews release planning, checks
application/test types, runs ESLint, tests with coverage and real disposable
PostgreSQL/Redis, checks formatting and documentation, and verifies coverage
transfer within the same run. All these checks fail on errors. A second job
builds, checks both sets of types and runs unit tests on the minimum supported
Node 24 version. Its opt-in integration scenarios remain skipped.

The `commitlint` job validates the prospective squash header using the PR title
and locked commitlint configuration. Dependency Review fails for high/critical
vulnerabilities in changed dependencies. Its dependency graph prerequisite must
be activated separately; an unavailable service is a failure, not a clean review.

`Quality checks` requires shared validation, Dependency Review and commitlint to
succeed on PRs. On pushes/manual runs, the two PR-only jobs must be skipped and
shared validation must succeed. Failures, cancellations, missing results and
unexpected skips fail the gate. Sonar is excluded from this acceptance result.

The release workflow independently selects an immutable source SHA, calls the
same validation, then generates source assets and invokes its isolated trusted
publisher. Both Node validation jobs must succeed. Revalidation is deliberate:
recovery can select a different SHA from the triggering commit. No cross-run
search or reuse of stale evidence is implemented. See [releases](releases.md).

## Tests and coverage

`pnpm ci:test` discovers test workspaces and requires each to declare
`test:coverage`. It removes old generated coverage, executes every workspace and
collects machine-readable Vitest execution reports. Missing reports, zero tests
and unsuccessful commands fail validation. The console/GitHub summary lists each
workspace and its result; GitHub test annotations remain enabled.

`pnpm ci:test:integration` runs that same suite against the dedicated
`compose.iam-test.yml` services. Startup failure prevents test execution; cleanup
runs after startup/test failure, and cleanup failure also fails a successful run.
The child test environment uses `TZ=UTC`, matching the hosted Linux runner.
Only disposable localhost endpoints are supplied. No application volume or
production credential is used.

`pnpm ci:test:tooling` keeps the native Node tests and enables Node's built-in
V8 coverage with spec and LCOV reporters. It writes `coverage/scripts/lcov.info`
with repository-relative source paths. Tests of spawned CLI processes remain
instrumented. The primary job runs this collection before LCOV merging; the Node
24 job also exercises it for runtime compatibility but does not export a second
coverage artifact. No coverage-conversion dependency or separate analysis
pipeline is introduced.

The LCOV merger requires a nonempty valid report from every expected test
workspace and the native report containing all four CI scripts, converts source paths to repository-relative paths and rejects missing
or escaping sources. The resulting artifact is uploaded, downloaded and compared
in the same run even when Sonar is unavailable. The tests cover the
runner, real command exit/launch failures, service lifecycle, CLI cleanup,
required-check acceptance, missing native/workspace reports and invalid LCOV
records/counters. Native coverage is merged using its repository source root;
Vitest reports retain their workspace roots and counters. Missing expected script
sources, duplicate sources or incomplete declared line counts fail collection.

Use this order for local coverage validation:

```bash
pnpm build
pnpm ci:test:integration
pnpm ci:test:tooling
node scripts/merge-coverage.mjs
```

The four required native sources are `merge-coverage.mjs`, `quality-gate.mjs`,
`run-integration-tests.mjs` and `run-workspace-tests.mjs` under `scripts/`.
Local V8 percentages describe the executed test suite; Sonar's new-code coverage
is a separate server-side measure over the PR diff and its coverable conditions.
A successful local report does not prove its remote import or Quality Gate.

## Informational SonarQube Cloud

Sonar is a separate read-only job with `continue-on-error: true`. It imports the
primary job's coverage from the same workflow run, waits for the remote Quality
Gate and reports scan/gate errors through warnings and a job summary. Transfer or
scanner failures stay visible. No required check or publisher depends on Sonar.

Fork PRs and PRs authored by `dependabot[bot]` never enter the secret-bearing job,
including when another actor reruns them. Non-main manual dispatches also skip it.
The scan job does not install project dependencies or run candidate lifecycle
scripts. No `pull_request_target`, privileged `workflow_run` or inherited secret
set is used.

Provision/configure separately:

| Setting              | Kind                | Intended value                        |
| -------------------- | ------------------- | ------------------------------------- |
| `SONAR_PROJECT_KEY`  | Repository variable | `Oxelio_architecture-web`             |
| `SONAR_ORGANIZATION` | Repository variable | `oxelio`                              |
| `SONAR_HOST_URL`     | Repository variable | `https://sonarcloud.io`               |
| `SONAR_TOKEN`        | Repository secret   | Analysis token scoped to this project |

Missing configuration or a non-HTTPS endpoint produces a visible warning/skip.
Never log or commit token values. Before enabling CI analysis, deactivate the
project's automatic analysis: the two modes cannot run concurrently. Confirm the
subscription supports the intended PR analysis and verify LCOV source resolution
in a configured run. The existence of a token name or a green automatic-analysis
check proves neither CI activation nor coverage import. See the official
[CI integration guidance](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/overview-of-integrated-cis)
and [JavaScript/TypeScript coverage guide](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage).

## Reference and platform activation

The reference was [Forge Publish at fc109e0](https://github.com/Oxelio/forge-publish/tree/fc109e0bb7734d59c445f811de02f99e5adbc17e),
including its CI, integration, compatibility, Sonar and release workflows. Reused
practices are locked tooling, pinned actions, read-only validation, dependency
review, supported-runtime checks, real isolated services and same-run coverage.
Architecture Web intentionally keeps Sonar informational. Python tooling,
Forgejo/PyPI publication, Windows matrices and Python distribution
SBOM/attestation contracts are not copied into this source-release project.
No arbitrary global coverage threshold is introduced.

Before enforcing this CI, a maintainer must separately verify the dependency
graph, compatible main-branch restrictions, ordinary squash/title settings and
required check identities. `Quality checks` is the CI acceptance check; the Work
Merge Gate remains independent. Neither Sonar's Actions job nor its externally
published Quality Gate should be required during this phase. This Work does not
change protections, secrets, merge settings or Work State. Record live inventory
and activation evidence in the owning Work/PR, rather than treating these
operational observations as permanent policy.
