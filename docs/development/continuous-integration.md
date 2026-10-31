# Continuous integration

The [delivery profile](../project/delivery-pipeline.md) owns branch policy,
permissions and gates. [Testing and verification](testing.md) owns validation
strategy and commands. Work #62 extends the existing workflows; it does not
authorize merge, deployment, new environments or changes to GitHub protections.

## Repository checks

`delivery-automation-validation.yml` runs on Pull Requests into `main`, pushes to
`main` and manual dispatch. It preserves the existing validation job identity and
checks the selected GitHub candidate, including the synthetic merge commit for a
PR. Run URLs and commit identities remain the validation evidence; a subsequent
candidate needs fresh results. Only superseded PR runs are cancelled.

The primary job uses `.nvmrc` and the exact pnpm version in `packageManager`,
installs the frozen lockfile, builds, previews release planning, checks production
and test types, runs ESLint, tests with coverage, formatting, documentation links,
link-checker tests and whitespace checks. Its tests use the isolated PostgreSQL
and Redis services from `compose.iam-test.yml`. Service startup or test failures
fail validation. Cleanup runs even after failure. No production endpoint or
credential is used.

A second job builds, checks types and runs unit tests on the minimum supported
Node 24 version from `package.json`. The primary job validates the Node 26 line.
The extra run intentionally leaves database integration to the primary job.
No Windows application-support claim or browser E2E coverage is introduced.

Dependency review runs on PRs and fails for high/critical vulnerabilities in
changed dependencies. It requires GitHub's dependency graph/review capability;
an unavailable service is a visible failure, not a successful review.

`commitlint.yml` remains the owner of the Conventional PR-title check. It checks
the prospective squash commit header using the existing commitlint config. It
does not lint the complete historical commit range or generate release commits.
The release planner independently validates release history under the accepted
release policy.

The existing release workflow retains its own immutable-candidate validation
before generating and publishing source archives. That test step also starts
the same isolated database services, so integration failures prevent publication.
It does not depend on Sonar or re-run the whole PR workflow through a second
wrapper. Publisher credentials remain isolated from candidate execution.

## Informational SonarQube

Sonar consumes the primary validation job's LCOV artifact from the **same run**.
`scripts/merge-coverage.mjs` converts workspace-relative source paths to
repository-relative paths and rejects missing/escaping sources and empty reports.
Coverage generation and artifact creation are ordinary blocking checks.

The separate Sonar job has `continue-on-error: true`. It waits for the remote
Quality Gate, records the analysis outcome in the job summary and emits a warning
on analysis, transfer or Quality Gate failure. Its failure never supplies a
business outcome or changes the Work Merge Gate, repository checks or release
publisher. Do not configure this informational job or Sonar's separately
published Quality Gate check as a required status check during this phase.

Fork PRs and PRs authored by `dependabot[bot]` skip the secret-bearing Sonar job,
including when another actor reruns them. Ordinary checks still run with read-only
repository permissions. No `pull_request_target` or privileged `workflow_run`
execution of candidate code is used. The scan job does not install project
dependencies or execute application lifecycle scripts.

Provision the Sonar project separately, then configure:

| GitHub setting       | Kind                | Value                                                |
| -------------------- | ------------------- | ---------------------------------------------------- |
| `SONAR_PROJECT_KEY`  | Repository variable | Exact provisioned project key                        |
| `SONAR_HOST_URL`     | Repository variable | HTTPS analysis endpoint from project setup           |
| `SONAR_ORGANIZATION` | Repository variable | Required for SonarQube Cloud; leave unset for Server |
| `SONAR_TOKEN`        | Repository secret   | Analysis token scoped to the intended project        |

Missing required configuration or a non-HTTPS endpoint produces a visible skip
with a warning. Incomplete Cloud organization configuration is reported as an
informational scan failure. Do not place token values in Git, workflow arguments,
logs or documentation. Switch off Sonar automatic analysis when enabling CI-based
analysis with coverage, and ensure the selected subscription supports the desired
PR/branch analysis. See the official [GitHub Actions setup](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud/)
and [JavaScript/TypeScript coverage guide](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage).

Live activation requires a configured run and confirmation that reports resolve
to the correct sources in the Sonar dashboard. Workflow presence alone is not
evidence of a successful analysis.

## Reference and enforcement

The comparison used [Forge Publish](https://github.com/Oxelio/forge-publish/tree/fc109e0)
at commit `fc109e0`: its real CI, integration, compatibility, Sonar and release
workflows. Reused practices include frozen tooling, immutable action references,
read-only checks, dependency review, supported-runtime validation, real isolated
integration tests and coverage transfer. Architecture Web deliberately keeps
Sonar informational, as requested; Forge Publish currently requires its internal
PR analysis to succeed.

Python/Pyright/Ruff, Forgejo package publishing, PyPI installation, platform
matrices and Python distribution SBOM/attestation checks belong to Forge
Publish's product and packaging contracts. They are not copied into this
TypeScript source-release project. Architecture Web already verifies source
archives, version manifests, checksums and release publication through its
release suite; see [the release guide](releases.md).

Workflow failures and platform enforcement are distinct. Review actual GitHub
rules before adding required checks. The platform inventory and activation
limitations are recorded in [Work #62](https://github.com/Oxelio/architecture-web/issues/62).
A maintainer must resolve incompatible restrictions and choose required check
identities separately. This implementation does not change or bypass protections
or claim merge enforcement is activated. Reviews, candidate-bound validation and
the Work Merge Gate remain independently required.
