# Technical Design — Work #16 package-first workspace migration

**Artifact status:** Accepted
**Content status:** Canonical
**Document type:** Technical Design
**Domain:** Workspace / package topology

## Work context

**Work:** [#16 — Adopt package-first workspace topology](https://github.com/Oxelio/Architecture-Web/issues/16)

**Work Type:** Architecture Change

**Workflow Depth:** Complex

**Authorized functional source:** Not applicable. Work #16 intentionally preserves product behavior.

**Architecture owners:**

- [Architecture principles](../project/architecture-principles.md)
- [Dependency rules](dependency-rules.md)
- [Current architecture](overview.md)
- [Packages and public APIs](packages.md)
- [ADR-0007 — Package-first workspace topology](decisions/0007-package-first-workspace-topology.md)
- [Delivery profile](../project/delivery-pipeline.md)
- [Testing and verification](../development/testing.md)

ADR-0007 is the accepted structural target. This Technical Design owns the migration mechanics for Work #16. It does not make the target topology Current Truth before implementation is effective.

## 1. Authorized constraints to preserve

Implementation MUST preserve the constraints owned by ADR-0007 and the existing architecture owners:

- product behavior is unchanged;
- existing package identities are unchanged;
- existing public package exports are unchanged;
- bounded-context responsibilities and vocabulary are unchanged;
- domain/application packages remain cohesive packages and are not split by architectural layer;
- dependency direction remains governed by `dependency-rules.md`;
- infrastructure packages remain adapters for their existing application contracts;
- package publication/versioning policy is unchanged and remains outside this Work;
- unrelated dependency cleanup, feature work, Notifications-to-IAM redesign, and repository-wide dependency-enforcement tooling remain out of scope;
- current architecture/package documentation continues to describe Current Truth until the migration becomes effective.

The historical `packages/iam/infrastructure/persitence/...` grouping path disappears as a consequence of moving the existing `@architecture/iam-persistence-kysely` package to the direct package root required by ADR-0007. This is not a package rename or a separate persistence architecture change.

## 2. Target package topology

After the migration, every direct child of `packages/` that participates in the workspace is an actual package root. The expected package roots are:

```text
packages/
├── audit/
├── audit-persistence-kysely/
├── delivery-automation/
├── eslint-config/
├── foundation/
├── iam/
├── iam-email-nodemailer/
├── iam-email-postmark/
├── iam-email-verification-sha256/
├── iam-password-argon2/
├── iam-password-bcrypt/
├── iam-persistence-kysely/
├── iam-session-redis/
├── messaging/
├── messaging-persistence-kysely/
├── notifications/
├── notifications-delivery-nodemailer/
├── notifications-delivery-slack-webhook/
├── notifications-delivery-sms-webhook/
├── notifications-persistence-kysely/
└── notifications-recipient-iam-kysely/
```

`packages/foundation` and `packages/eslint-config` are already direct package roots and do not move.

### Physical migration map

| Existing package root | Target package root | Package identity | Required internal change |
| --- | --- | --- | --- |
| `packages/iam/core` | `packages/iam` | `@architecture/iam` | move production `domain/` and `application/` below `src/` |
| `packages/iam/infrastructure/persitence/kysely` | `packages/iam-persistence-kysely` | `@architecture/iam-persistence-kysely` | root move only |
| `packages/iam/infrastructure/session/redis` | `packages/iam-session-redis` | `@architecture/iam-session-redis` | root move only |
| `packages/iam/infrastructure/security/argon2` | `packages/iam-password-argon2` | `@architecture/iam-password-argon2` | root move only |
| `packages/iam/infrastructure/security/bcrypt` | `packages/iam-password-bcrypt` | `@architecture/iam-password-bcrypt` | root move only |
| `packages/iam/infrastructure/security/sha256` | `packages/iam-email-verification-sha256` | `@architecture/iam-email-verification-sha256` | root move only |
| `packages/iam/infrastructure/email/nodemailer` | `packages/iam-email-nodemailer` | `@architecture/iam-email-nodemailer` | root move only |
| `packages/iam/infrastructure/email/postmark` | `packages/iam-email-postmark` | `@architecture/iam-email-postmark` | root move only |
| `packages/audit/core` | `packages/audit` | `@architecture/audit` | move production `domain/` and `application/` below `src/` |
| `packages/audit/infrastructure/persistence/kysely` | `packages/audit-persistence-kysely` | `@architecture/audit-persistence-kysely` | root move only |
| `packages/messaging/core` | `packages/messaging` | `@architecture/messaging` | move production `domain/` and `application/` below `src/` |
| `packages/messaging/infrastructure/persistence/kysely` | `packages/messaging-persistence-kysely` | `@architecture/messaging-persistence-kysely` | root move only |
| `packages/notifications/core` | `packages/notifications` | `@architecture/notifications` | move production `domain/` and `application/` below `src/` |
| `packages/notifications/infrastructure/persistence/kysely` | `packages/notifications-persistence-kysely` | `@architecture/notifications-persistence-kysely` | root move only |
| `packages/notifications/infrastructure/delivery/nodemailer` | `packages/notifications-delivery-nodemailer` | `@architecture/notifications-delivery-nodemailer` | root move only |
| `packages/notifications/infrastructure/delivery/slack-webhook` | `packages/notifications-delivery-slack-webhook` | `@architecture/notifications-delivery-slack-webhook` | root move only |
| `packages/notifications/infrastructure/delivery/sms-webhook` | `packages/notifications-delivery-sms-webhook` | `@architecture/notifications-delivery-sms-webhook` | root move only |
| `packages/notifications/infrastructure/recipient/iam-kysely` | `packages/notifications-recipient-iam-kysely` | `@architecture/notifications-recipient-iam-kysely` | root move only |
| `packages/tooling/delivery-automation` | `packages/delivery-automation` | `@architecture/delivery-automation` | root move only |

No other package root is created, renamed, merged, or split by this Work.

## 3. Cohesive core package layout

The IAM, Audit, Messaging, and Notifications core packages keep their current package identities and public subpaths. Their target internal shape is:

```text
packages/<context>/
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── eslint.config.mjs
├── vitest.config.ts          # when currently present
└── src/
    ├── domain/
    └── application/
```

Package-local files that already belong to the package root remain at the package root. Existing source/test organization inside `domain/` and `application/` is preserved; this Work does not reorganize domain models, use cases, tests, or ports.

### TypeScript build shape

For these cohesive packages:

- build `rootDir` becomes `src`;
- build `outDir` remains `dist`;
- build includes point at the relocated `src/domain/**` and `src/application/**` trees;
- the emitted public layout remains `dist/domain/**` and `dist/application/**`;
- test typechecking may keep `rootDir: "."` with `noEmit: true` so tests and source can be checked together when tests are outside the build root;
- stale/non-owning include globs may be removed only when mechanically required by the move and verified not to describe existing source.

This preserves the compiled shape expected by current `exports`, `main`, and `types` fields.

### Package import maps and Vitest aliases

For package-local `imports` entries used to resolve source during development or tests:

- source/type targets that currently point at `./domain/...` or `./application/...` move to `./src/domain/...` or `./src/application/...`;
- compiled/default targets continue to point at `./dist/domain/...` or `./dist/application/...`.

Vitest aliases and coverage include patterns that currently point at the package-root `domain/` or `application/` trees move to the corresponding `src/` paths.

Public `exports` MUST NOT change as part of this Work.

## 4. Infrastructure and tooling packages

Infrastructure packages and `@architecture/delivery-automation` already own their internal implementation below their package roots. Their migration is a physical root move.

For each moved package:

- preserve `name`, `version`, `private`, `main`, `types`, `exports`, dependencies, peer dependencies, scripts, and public contract;
- preserve its internal source tree unless a relative path must change solely because the package root moved;
- do not alter adapter responsibilities or replace dependencies;
- do not introduce new cross-package imports;
- do not convert package-name imports into filesystem-relative imports.

The new direct root name follows the existing package identity, not an invented taxonomy.

## 5. Workspace discovery and lockfile

`pnpm-workspace.yaml` currently discovers:

```yaml
packages:
  - "apps/*"
  - "packages/**"
```

After all package roots have moved, the target is:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

The workspace glob MUST NOT be narrowed to `packages/*` before all intended package roots are direct children, otherwise still-nested packages would silently leave the workspace during an intermediate migration state.

`pnpm-lock.yaml` is path-sensitive because workspace importer keys are based on package locations. After each implementation checkpoint that moves package roots, regenerate the lockfile with the repository-pinned pnpm version. Review the lockfile diff: importer paths are expected to move; package versions, dependency selections, and unrelated resolutions are not expected to change.

A clean `pnpm install --frozen-lockfile` must succeed after the final lockfile is committed.

## 6. Repository-owned path-sensitive surfaces

The implementation must treat package names and filesystem paths separately.

Package-name imports should normally remain unchanged. Physical-path references must be updated where their target moves.

Known path-sensitive surfaces include:

- `pnpm-workspace.yaml`;
- `pnpm-lock.yaml` importer paths;
- core package `package.json`, `tsconfig*.json`, Vitest configuration, and any package-local path aliases affected by the new `src/` root;
- `apps/api/Dockerfile`, which currently copies IAM package manifests using nested physical paths;
- `.github/workflows/delivery-automation-validation.yml`, whose path filter currently references `packages/tooling/delivery-automation/**`;
- other `.github/workflows/**` references discovered by repository search;
- migration/schema paths and repository scripts that refer to nested package locations;
- documentation links/path examples that become stale when the migration is effective.

Before considering the physical migration complete, search the repository for the old grouping paths. At minimum, inspect matches for:

```text
packages/iam/core
packages/iam/infrastructure
packages/audit/core
packages/audit/infrastructure
packages/messaging/core
packages/messaging/infrastructure
packages/notifications/core
packages/notifications/infrastructure
packages/tooling/delivery-automation
packages/**
```

Historical rationale in ADRs may legitimately mention old paths. Every other remaining occurrence must either be updated or explicitly justified.

## 7. Composition and dependency direction

Application composition remains package-contract based.

- `apps/api` continues to import workspace packages through their existing package names/public exports.
- Adapter packages continue to depend inward on the application/domain packages whose ports or contracts they implement.
- Flattening does not authorize direct infrastructure dependencies from domain or application code.
- The historical `SecurityService` exception remains unchanged and MUST NOT be used as justification for new boundary violations.

No application flow, transaction boundary, messaging contract, persistence semantics, security behavior, or runtime configuration behavior changes in this Work.

## 8. Migration sequence

The migration should be executed as a sequence of buildable checkpoints while `packages/**` remains active until the direct-root migration is complete.

### Checkpoint A — cohesive core packages

For IAM, Audit, Messaging, and Notifications:

1. promote the existing core package files to the direct context root;
2. move `domain/` and `application/` below `src/`;
3. update package-local source aliases/import maps, TypeScript configuration, Vitest aliases, and coverage paths;
4. preserve public exports and emitted `dist` layout;
5. update repository-owned physical references affected by these core moves;
6. refresh lockfile importer paths;
7. run affected package and consumer validation.

### Checkpoint B — IAM adapters

Move all IAM adapter package roots to their accepted direct roots, update repository-owned path references, refresh lockfile importer paths, and validate the IAM packages plus API composition/build.

### Checkpoint C — Audit, Messaging, Notifications, and delivery tooling

Move the remaining nested adapter packages and `@architecture/delivery-automation`, update their repository-owned path references and workflow filters, refresh lockfile importer paths, and run affected package/tooling validation.

### Checkpoint D — workspace finalization

Once every intended package root is direct:

1. change workspace discovery from `packages/**` to `packages/*`;
2. regenerate and review the final lockfile;
3. verify the expected package set and absence of nested workspace manifests;
4. search for obsolete physical paths;
5. perform full workspace validation.

### Checkpoint E — Current Truth synchronization

Only after the target topology is physically effective and validated, update the current-state owners:

- `docs/architecture/overview.md`;
- `docs/architecture/packages.md`;
- `docs/architecture/dependency-rules.md` only for obsolete path examples/import guidance;
- other current repository documentation whose physical paths are now stale.

Do not rewrite ADR-0007 as a changelog; it remains the rationale owner.

## 9. Migration and compatibility

This Work is a repository topology migration, not a public package contract migration.

Compatibility invariants:

- package `name` values are unchanged;
- public `exports` are unchanged;
- `main` and `types` public entry points are unchanged;
- dependency direction and declared package relationships are unchanged;
- applications continue to consume the same package identities;
- build output subpaths for cohesive packages remain compatible.

Package-local `imports` source/type targets may change because they are internal to the moved package source layout.

The repository does not establish external compatibility for consumers that depend directly on internal monorepo filesystem paths.

## 10. Failure handling and rollback

The migration does not alter runtime failure semantics.

For execution failures:

- if a checkpoint fails because a physical reference was missed, correct that reference within the same checkpoint;
- if a package identity/export/dependency must change to make the move work, stop and return to Software Architect activity instead of silently widening Work #16;
- if product behavior must change, stop and route to Product/Domain analysis;
- if dependency resolution changes unexpectedly, inspect the lockfile and package manifests before continuing.

Git provides rollback/history. Do not create parallel `old`, `backup`, or temporary duplicate package trees as a migration strategy.

## 11. Validation strategy

Validation must demonstrate both topology and preservation of existing package contracts.

### Package-set evidence

After Checkpoint D:

- every direct child of `packages/` listed in the target topology has a `package.json`;
- no workspace `package.json` remains below the direct-child level;
- `pnpm` discovers `apps/*` plus the expected 21 direct package roots;
- package identities match the pre-migration identities.

A pre/post manifest snapshot SHOULD compare, keyed by package name:

- `name`;
- `exports`;
- `main`;
- `types`;
- dependencies and peer dependencies.

The expected difference is physical location plus package-local source `imports` needed for the four cohesive core packages.

### Dependency/install evidence

```bash
pnpm install --frozen-lockfile
```

The final lockfile diff must not contain unexplained dependency/version churn.

### Repository validation

Run the canonical root commands:

```bash
pnpm build
pnpm typecheck
pnpm typecheck:test
pnpm lint
pnpm test
pnpm format:check
```

Because the API Dockerfile contains explicit package paths and is changed by this Work, also validate its build boundary when Docker is available:

```bash
docker build -f apps/api/Dockerfile .
```

If Docker execution is unavailable locally, equivalent CI evidence is required before the Work completes validation.

### Structural/path evidence

Inspect remaining old-path matches after the migration. Historical references in ADR rationale are allowed; active build/config/tooling/current-documentation references are not.

Architecture Review must verify:

- ADR-0007 is implemented;
- package identities/public exports are preserved;
- bounded-context ownership has not changed;
- dependency direction still satisfies `dependency-rules.md`;
- no new deep/private cross-package imports were introduced.

Functional Compliance Review is not triggered because no product behavior is intentionally changed. Any observed behavior change is a defect/blocker, not an accepted consequence of this Work.

## 12. Alternatives and trade-offs

ADR-0007 owns the structural alternatives and the decision to use a flat package-first workspace. This Technical Design does not reopen that decision.

For execution, the selected approach keeps recursive workspace discovery during intermediate checkpoints and narrows it only after package moves are complete. This avoids accidentally dropping not-yet-migrated packages from pnpm while still allowing the migration to be performed in reviewable checkpoints.

The cost is temporary coexistence of direct and nested package roots on the Work branch. That state is explicitly transitional and must not be merged as the completed architecture.

## 13. Referenced ADRs

- ADR-0001 — Technology-independent IAM core
- ADR-0002 — Specialized pnpm monorepo packages
- ADR-0003 — Manual composition in the API
- ADR-0007 — Package-first workspace topology

No additional ADR is triggered by the migration mechanics described here.

## 14. Risks and unresolved technical decisions

### Risks carried into implementation/review

1. **Missed physical path reference.** Mitigation: repository-wide stale-path search plus build/CI/Docker evidence.
2. **Lockfile resolution churn hidden by importer moves.** Mitigation: inspect the lockfile diff and reject unrelated dependency changes.
3. **Core source relocation changes emitted paths or test aliases.** Mitigation: preserve `dist/domain` and `dist/application`, update only source-facing paths, and run build/typecheck/tests.
4. **Large move diff obscures architecture changes.** Mitigation: execute in the defined checkpoints and keep unrelated cleanup out of the Work.
5. **Current-state documentation updated too early.** Mitigation: synchronize only after Checkpoint D establishes the effective topology.

There is no unresolved functional or structural decision required from the implementer. Any discovery that would require changing a package identity, public API, bounded-context responsibility, dependency rule, or product behavior is a blocker and must return upstream.

## 15. Task-planning inputs

Use serialized GitHub Sub-issues under Work #16:

1. migrate cohesive core packages to direct roots and `src/`;
2. flatten IAM adapter package roots;
3. flatten Audit/Messaging/Notifications adapters and delivery tooling;
4. finalize workspace discovery, lockfile, repository path references, and full structural validation;
5. synchronize current architecture/package documentation after the topology is effective.

Each Task references this Technical Design and ADR-0007 rather than duplicating their normative content. Implementation is routed to the human maintainer; AI preparation does not authorize automated modification of the package topology.
