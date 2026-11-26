# Technical Design — Native TypeScript for root CI tooling

**Artifact status:** Accepted technical target (not implemented)

**Content status:** Proposed

**Document type:** Technical Design

**Work:** [#171](https://github.com/Oxelio/architecture-web/issues/171) — Technical Change / Standard

**Domain:** Development tooling / CI

## Scope and authoritative constraints

Migrate the repository-owned executable sources and tests under root
`scripts/` from `.mjs` to native Node.js `.ts`, preserving their behavior,
command-line contracts, failure behavior, and validation evidence. This is
a technical refactor, not a change to product behavior, security policy,
required checks, merge authority, delivery governance, or release behavior.

The [Project Method Profile](../project/project-method-profile.md) resolves
the relevant owners. The [delivery profile](../project/delivery-pipeline.md)
owns CI and Work gates; [testing](testing.md) and
[continuous integration](continuous-integration.md) own validation policy;
the existing [PR validation design](pull-request-validation-design.md) owns
identity, provenance, and metadata-evidence semantics. This document owns
only the accepted technical implementation target for Work #171.

Current code and tests remain effective until this target is implemented and
validated. The [Work exploration](https://github.com/Oxelio/architecture-web/issues/171)
records the alternatives and operator evidence; it is not a second design owner.

### Baseline and inventory

At the start of Work #171, root `scripts/` contains seven executable/support
modules and six test modules using `.mjs`. The executable inventory is:

- `check-markdown-links`
- `merge-coverage`
- `pr-validation-evidence` and its `quality-gate` CLI
- `run-integration-tests`
- `run-o2-mailpit-test`
- `run-workspace-tests`

The six test files comprise five directly selected by
`ci:test:tooling` and `o2-mailpit-smoke.test.mjs`, which is invoked by the
isolated Docker fixture. The quality-gate tests exercise
`pr-validation-evidence`.

Operator evidence under Windows/Node 24.19.0 and 26.13.1 establishes a
**pre-migration** baseline of 65/65 tooling tests and seven LCOV source records,
with 95.55% line, 95.16% branch, and 98.91% function coverage. An isolated
`.ts` sample executed without `tsx`, passed two native Node tests, and
generated LCOV on both versions. Neither observation validates a migrated
repository candidate or the exact minimum supported versions.

## Target execution model

Use native TypeScript type stripping in the supported Node versions
(`^24.15.0 || ^26.8.1`). The root `package.json` already declares
`"type": "module"`; source files can use `.ts` without switching to
`.mts`. Relative runtime imports use explicit `.ts` extensions and type-only
imports use `import type`.

Code executed by Node must use _erasable_ TypeScript syntax. Do not introduce
runtime enums, parameter properties, namespaces requiring runtime transforms,
TypeScript path aliases, decorators requiring transforms, or a runtime
transpiler. Keep native Node built-in imports, supported ESM behavior,
`import.meta` entry-point checks, CLI arguments, exit codes, stdout/stderr
semantics, and Windows/Linux path handling.

Node's runtime strips types; it **does not typecheck**. Add a dedicated root
`tsconfig.scripts.json` and direct root development dependencies on
`typescript` (compatible with the repository's TypeScript 5.9 toolchain)
and `@types/node` (Node 24 major). Resolve compatible versions using the
existing pnpm lockfile and update the root importer through pnpm; do not
hand-edit the dependency graph or change unrelated workspace dependencies.
Use the minimum supported Node 24 surface; successful compilation does not
prove that a later Node 24 patch API exists in 24.15.0. Verify both pinned
runtimes. The configuration must enable:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "NodeNext",
    "strict": true,
    "noEmit": true,
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  },
  "include": ["scripts/**/*.ts"]
}
```

The root script `typecheck:scripts` runs
`tsc --noEmit -p tsconfig.scripts.json`. Include **source and test** files in
this check. Extend root `typecheck` to execute that check in addition to the
existing recursive workspace typechecks, so both CI compatibility jobs enforce
it. Extend the root lint command to cover `scripts/` using the existing
ESLint configuration and retain recursive workspace lint. Keep root `lint:fix`
consistent with root `lint`. Existing root `format:check` continues to cover
the scripts. Enable these root TypeScript checks in the same coherent change
that introduces the migrated files, not against an empty TypeScript project.

External GitHub API responses, event JSON, subprocess results, and Docker
inspection data remain untrusted at runtime: static types must not replace
existing explicit validation and fail-closed checks. Introduce the smallest
necessary types and narrowing at the external boundary, preserving the
existing acceptance/rejection contract. Do not suppress errors through a broad
`any`, unchecked assertions, or weakened compiler options. If necessary
runtime validation would intentionally change a contract, return to the
appropriate owner rather than expanding scope.

## CI bootstrap and provenance

The primary and Node 24 compatibility jobs in
`.github/workflows/repository-validation.yml` currently run
`node scripts/quality-gate.mjs identity` **before** `actions/setup-node`,
relying on the runner's default Node. This is unsuitable for a native
TypeScript executable whose supported runtime is defined by the repository.

For **both** jobs, move their existing pinned `actions/setup-node` step to
before `Record PR validation identity`, while maintaining this sequence:

1. Checkout the exact candidate.
2. Perform the existing immutable SHA/base verification where currently
   applicable (primary job).
3. Configure Node: `.nvmrc` for primary, explicit `24.15.0` for compatibility.
4. Execute `quality-gate.ts identity` and publish its immutable identity artifact.
5. Set up pnpm, install locked dependencies, and run the remaining checks.

Identity generation and artifact publication **must still finish before any
candidate dependency installation or build**. Preserve identity values,
validation of the actual checkout/parents, run/attempt associations, and
failure semantics defined by the PR validation design. `quality-gate.ts`
and its imported `pr-validation-evidence.ts` must remain dependency-free for
the `identity` and `route` paths; runtime imports of `@commitlint/cli`
or other installed packages are prohibited at this stage. The existing
post-install `Quality checks` job may continue to use locked commitlint
when it actually validates a PR title.

The route and quality jobs in
`.github/workflows/delivery-automation-validation.yml` already configure
Node before invoking the gate; update their CLI paths without changing their
routing or required-check rules.

The existing resolver verifies the successful identity record/upload steps and
requires their order to precede `Install locked dependencies`. It does not
require identity generation to precede runtime setup. Retain these exact
step names, job identities, immutable candidate inputs, action pins, and
read-only permissions; do not introduce a dependency install, package-manager
cache restore or candidate build ahead of identity publication. The primary
job continues to select the runtime from the candidate's `.nvmrc`, within
the existing reviewed-workflow trust boundary; the compatibility job retains
its explicit minimum-version pin.

If a candidate-bound CI proof demonstrates that the selected step reordering
cannot preserve provenance, stop and return to Technical Design. A minimal
JavaScript bootstrap entry point is a fallback alternative, not permission to
invent duplicate identity logic or weaken evidence verification.

## Tests, coverage, and external entry points

Retain `node:test` and native V8/LCOV coverage rather than introducing Vitest,
`tsx`, or a build phase for root scripts. Migrate the six tests to
`.test.ts` and update imports and explicit test-file arguments. In
`ci:test:tooling`, use `--test-coverage-include=scripts/*.ts` and
`--test-coverage-exclude=scripts/*.test.ts`; keep the spec and LCOV reporters
and `coverage/scripts/lcov.info` location.

Update `CI_SOURCES` in `merge-coverage.ts` to the seven `.ts` source paths;
its fail-closed checks for missing, duplicate, escaping, malformed or empty
sources must remain intact. If additional runtime helper files are introduced,
extend the source inventory rather than silently excluding them. The existing
coverage merger normalizes Windows backslashes to repository-relative POSIX
paths. Prove the merged `coverage/lcov.info` contains all expected scripts
and is accepted by the external Sonar analysis. Update
`sonar-project.properties` only where needed; it already includes
`**/*.test.ts` and `**/*.test.mjs`.

The mailpit fixture currently invokes
`/app/scripts/o2-mailpit-smoke.test.mjs`; update the container-side path,
fixture assertions, and test invocation together. Update the root
`package.json`, direct spawned CLI paths, GitHub Actions, and affected
documentation atomically with their source/test changes. Preserve the
standalone Docker fixture isolation and cleanup guarantees.

This Work does **not** migrate `eslint.config.mjs`, the reusable
`@architecture/eslint-config` package's exported `.mjs` modules,
generated `apps/api/dist/main.mjs`, or unrelated application scripts.

## Sequencing and execution units

Implement on one temporary Work Integration branch/PR, keeping the PR in
Draft while preparation and implementation are incomplete.

The Work itself is one bounded execution unit for one Developer. Separate
Task Sub-issues are not warranted: inter-module imports, native test
selection, `CI_SOURCES`, callers and documentation are a coupled migration,
and all changes must be validated together on one candidate. The following
sequence guides local implementation; it is not separate Work or parallel
Task ownership.

1. Reorder pre-install Node setup while the JavaScript tooling is unchanged;
   verify the existing contract and keep the existing checks executable.
2. Convert the source/test groups together with their imports and callers.
   Start with simpler tooling, then migrate the quality gate and evidence
   resolver as one group and the Mailpit fixture including its container
   invocation. Add the dedicated root typecheck and lint integration.
3. Switch the native test selection, coverage paths and `CI_SOURCES` together.
   If a mixed-extension intermediate commit is necessary, its explicit test
   selection and source inventory must cover both formats. Never submit a
   candidate with missing tests or silently omitted coverage sources. A
   single coherent conversion commit is preferable to introducing transitional
   machinery solely for intermediate commits.
4. Audit all tracked root-script callers, run the targeted checks, then the
   full candidate review/validation. Update current-state documentation in
   the same candidate to describe the implemented result; it becomes current
   only when the change is integrated and effective.

## Acceptance evidence and rollback

The change must demonstrate, on the actual candidate:

- `node scripts/quality-gate.ts identity` runs in **both** reusable jobs
  after explicit Node setup but **before** package installation; unchanged
  candidate/base/checkout identity, artifact publication, and fail-closed
  behavior.
- Exact minimum Node **24.15.0** compatibility job and `.nvmrc` Node
  **26.8.1** primary job run successfully. Windows Node 24/26 runs are useful
  additional compatibility evidence, not substitutes for the required CI.
- Strict root script and test typechecks are exercised by the existing
  `pnpm typecheck` CI step; existing lint, formatting and documentation checks
  remain green.
- Native tooling tests cover the migrated test files and preserve all
  intentional negative outcomes. Compare against the 65-test baseline,
  examining any changed count or materially reduced coverage.
- Native LCOV includes every declared source, the merge rejects incomplete
  reports, Sonar sees the migrated TypeScript sources, and coverage artifacts
  survive the existing upload/download round trip.
- Existing PR metadata/full routing, title verification, immutable candidate
  evidence and checked provider/job identities are preserved. Exercise the applicable real PR regression scenarios from
  [the existing PR validation design](pull-request-validation-design.md#validation-and-acceptance)
  on the migrated candidate, including title failure/correction, metadata
  reuse and candidate freshness; unit mocks cannot prove GitHub's actual
  required-check behavior. Record candidate/run/check identities and do not
  weaken checks if the live evidence is unavailable.
- The Mailpit container smoke scenario and fixture cleanup work on the
  migrated test path; no test receives new privileged access.
- Review distinguishes code quality, CI/provenance architecture and
  operational/security compatibility; validation evidence is current for the
  exact PR candidate.

No production database migration, release policy change, or runtime
deployment cutover is required. Keep `main` unchanged until the complete
candidate is accepted; restore the previous coherent code/workflow/coverage
state through Git if necessary. Do not maintain duplicate old implementations
as rollback artifacts.

## Readiness boundary

The preferred technical target is native `.ts` execution with a dedicated
typecheck and an explicitly pinned Node runtime ahead of pre-install identity
generation. This document records an **accepted local Technical Design
within the authorized technical scope**, not a change to project governance
or evidence that the migrated branch works. The Work's operational discussion
records the focused context, Task Planning outcome, and Readiness Review.
The implementing candidate must still satisfy the independent reviews and
validation evidence above. Work State is owned by the GitHub Project, not
this file.
