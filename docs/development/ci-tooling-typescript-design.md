# Technical Design — Native TypeScript for root CI tooling

**Artifact status:** Proposed technical target (not implemented)

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
only the proposed technical implementation for Work #171.

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

Code executed by Node must use *erasable* TypeScript syntax. Do not introduce
runtime enums, parameter properties, namespaces requiring runtime transforms,
TypeScript path aliases, decorators requiring transforms, or a runtime
transpiler. Keep native Node built-in imports, supported ESM behavior,
`import.meta` entry-point checks, CLI arguments, exit codes, stdout/stderr
semantics, and Windows/Linux path handling.

Node's runtime strips types; it **does not typecheck**. Add a dedicated root
`tsconfig.scripts.json` and direct root development dependencies on
`typescript` and `@types/node`. Use the minimum supported Node 24 surface
when selecting Node types; do not accidentally require Node 26-only APIs.
The configuration must enable:

```json
{
  "compilerOptions": {
    "target": "ESNext",
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
it. Integrate `eslint scripts` into root `lint` using the existing ESLint
configuration, without re-linting every workspace or modifying architecture
rules. Existing root `format:check` continues to cover the scripts.

External GitHub API responses, event JSON, subprocess results, and Docker
inspection data remain untrusted at runtime: static types must not replace
existing explicit validation and fail-closed checks. Introduce the smallest
necessary type guards and types, without a generic validation framework.

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

If a candidate-bound CI proof demonstrates that the step reordering violates
the existing provenance contract, retain a **minimal dependency-free JavaScript
bootstrap entry point** and escalate that design adjustment. Do not duplicate
identity decisions or weaken gate verification to remove the shim.

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

1. Configure the root typecheck/lint contract and reorder pre-install Node
   setup without changing the existing JavaScript quality-gate logic.
2. Migrate the simpler CLI/source/test pairs, updating callers while keeping
   current test and coverage contracts executable.
3. Migrate the quality-gate and PR evidence resolver together; exercise
   `route`, `identity`, metadata evidence reuse, candidate freshness,
   error handling, and intentional failures.
4. Migrate mailpit/Docker references, finalize native LCOV/CI/Sonar paths,
   remove stale root `.mjs` callers, and synchronize current documentation
   only after the new behavior is effective.

A unit may be refined into GitHub Task sub-issues during Task Planning where
sequencing or independently verifiable ownership justifies it. Tasks must
reference this design, not duplicate it.

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
  evidence, checked provider/job identities, and Work Merge Gate behavior
  are unchanged.
- The Mailpit container smoke scenario and fixture cleanup work on the
  migrated test path; no test receives new privileged access.
- Review distinguishes code quality, CI/provenance architecture and
  operational/security compatibility; validation evidence is current for the
  exact PR candidate.

No production database migration, release policy change, or runtime
deployment cutover is required. Revert the candidate refactor and CI step
changes together if these invariants cannot be met; preserve the original
`.mjs` implementation until the complete change is validated.

## Readiness boundary

The preferred technical target is native `.ts` execution with a dedicated
typecheck and an explicitly pinned Node runtime ahead of pre-install identity
generation. This document is a **proposed Technical Design**, not evidence
that the migrated branch works. Before `Ready`, perform Task Planning as
needed, review the CI trust boundary and validation plan, and record a
Readiness Review with a justified `READY`, `READY WITH RISKS` or
`NOT READY` result. Work State is owned by the GitHub Project, not this file.
