# ADR-0007 — Package-first workspace topology

**Status:** Accepted
**Content status:** Canonical
**Document type:** Architecture Decision Record
**Domain:** Workspace / package topology

## Context

Architecture Web uses a pnpm monorepo with private applications under `apps/`
and reusable or specialized packages under `packages/`. Package manifests,
package exports, and dependency rules materialize important architectural
boundaries.

The current workspace is discovered recursively through `packages/**`. Several
bounded-context and tooling directories therefore act as grouping directories
that contain multiple workspace packages. Examples include IAM, Audit,
Notifications, and private delivery tooling. Core domain/application packages
also use an additional `core/` directory between their bounded-context grouping
directory and their package root.

This topology reflects the repository's historical evolution, but the physical
hierarchy now carries two different meanings at the same level:

- some direct children of `packages/` are actual workspace packages;
- other direct children are taxonomic/grouping directories whose descendants
  are the actual packages.

ADR-0002 established the use of specialized pnpm monorepo packages. This ADR
refines that strategy by deciding how workspace package boundaries are
represented physically. It does not replace the architectural dependency rules,
bounded-context ownership, or public package contracts established elsewhere.

Work #16 coordinates the corresponding architecture change. Product behavior,
package identities, intentional public API changes, bounded-context
responsibilities, and publication/versioning policy are outside that Work.

## Problem

The recursive topology makes a path under `packages/` insufficient to identify
whether a directory is an architectural/package boundary or only a grouping
container. This has several consequences:

- workspace discovery accepts packages at arbitrary nesting depths;
- repository tooling and documentation must know historical physical nesting in
  addition to package identity;
- moving between a core package and one of its adapters changes both package and
  taxonomy depth;
- bounded-context ownership can be mistaken for filesystem containment even
  though dependency direction and public contracts, not parent directories,
  define the architectural relationship;
- package-level operations are less uniform because package roots do not share a
  single predictable depth.

The repository needs a durable rule for physical workspace topology that keeps
package boundaries explicit without changing the logical architecture those
packages implement.

## Decision drivers / constraints

The decision must preserve the following constraints:

- every existing package identity remains unchanged unless separately decided;
- existing public exports remain unchanged unless separately decided;
- IAM, Audit, Messaging, Notifications, and other bounded contexts retain their
  current ownership and vocabulary;
- domain and application layers remain infrastructure-independent;
- infrastructure packages continue to depend on the public contracts they
  implement or consume, according to the dependency rules;
- `@architecture/iam`, `@architecture/audit`, `@architecture/messaging`, and
  `@architecture/notifications` remain cohesive packages exposing their current
  domain/application APIs rather than being split into one npm package per
  architectural layer;
- package publication and versioning policy remain outside this decision;
- current architecture documentation must continue to describe the implemented
  topology until the migration is effective;
- the topology should be understandable from package roots without relying on
  arbitrary nesting conventions;
- workspace discovery should make the intended package-root depth explicit.

## Options considered

### Option A — Keep the recursive grouped topology

Keep bounded-context and tooling grouping directories and continue discovering
workspace packages recursively with `packages/**`.

**Advantages:**

- no physical migration;
- filesystem containment visually groups related adapters with their bounded
  context;
- existing path-based tooling and documentation remain unchanged.

**Disadvantages:**

- direct children of `packages/` continue to have mixed semantics;
- package roots remain at inconsistent depths;
- recursive workspace discovery permits new package roots at arbitrary depths;
- tooling and repository navigation must continue to understand both package
  identity and taxonomy directories;
- filesystem containment can overstate architectural ownership relationships
  that are actually governed by contracts and dependency direction.

### Option B — Flatten only infrastructure packages

Move specialized infrastructure packages to direct children of `packages/` but
retain `core/` and/or selected grouping directories for domain/application or
tooling packages.

**Advantages:**

- reduces the deepest infrastructure paths;
- limits the migration surface compared with a complete flattening;
- makes specialized adapters easier to locate from the workspace root.

**Disadvantages:**

- preserves mixed semantics for direct children of `packages/`;
- keeps more than one valid package-root depth;
- requires exceptions in workspace discovery and repository conventions;
- does not establish a simple durable topology rule.

### Option C — Adopt a package-first flat workspace topology

Make every direct child of `packages/` that participates in the pnpm workspace an
actual workspace package. Move architectural structure internal to a package
below that package root, normally below `src/`.

Representative target paths are:

```text
packages/iam
packages/iam-persistence-kysely
packages/iam-session-redis
packages/notifications
packages/notifications-persistence-kysely
packages/delivery-automation
```

For cohesive domain/application packages, internal architecture remains inside
the package:

```text
packages/iam/
├── package.json
└── src/
    ├── domain/
    └── application/
```

**Advantages:**

- one predictable package-root depth for all packages under `packages/`;
- package identity and physical package boundary align directly;
- workspace discovery can be constrained to the intended depth;
- bounded-context ownership is expressed by contracts, names, documentation,
  and dependency rules rather than requiring filesystem containment;
- tooling can enumerate package roots without recursive taxonomy knowledge;
- future package additions must deliberately become first-level package
  boundaries rather than appearing implicitly at arbitrary depths.

**Disadvantages:**

- requires a repository-wide physical migration and updates to path-sensitive
  tooling, CI, tests, build configuration, composition references, and docs;
- related infrastructure adapters are no longer visually nested under their
  bounded-context directory;
- package names become more important for discoverability because the filesystem
  no longer provides a second taxonomy level;
- large move-only diffs can make review and Git history navigation noisier.

## Decision

**Chosen option:** Option C — Adopt a package-first flat workspace topology.

**Rationale:**

The package manifest and its public exports are the repository's concrete
workspace/package boundary. The filesystem should represent that boundary
consistently instead of mixing package roots with taxonomic containers.

A flat package-first topology removes an accidental second ownership mechanism.
Infrastructure remains related to a bounded context because it implements or
consumes that context's explicit contracts and follows the dependency rules, not
because it is nested beneath the context's directory. Conversely, flattening a
package does not make it architecturally independent from the context whose
contracts it implements.

Cohesive domain/application packages remain single packages. Their internal
layering belongs below the package root, normally under `src/`, because domain
and application are architectural responsibilities inside that package rather
than separate workspace identities.

The target workspace discovery rule should therefore enumerate applications at
`apps/*` and packages at the direct-child level under `packages/` rather than
relying on recursive `packages/**` discovery. Exact migration mechanics remain
an implementation-oriented Technical Design concern, provided they preserve the
constraints above.

## Consequences

### Positive

- `packages/<name>` becomes a reliable representation of a workspace package
  boundary.
- Workspace package discovery becomes explicit and predictable.
- Package-level build, lint, typecheck, test, and dependency tooling can operate
  on a uniform root depth.
- Architectural relationships remain governed by dependency direction and
  public contracts instead of directory ancestry.
- Historical grouping directories can be removed once their descendants have
  migrated.
- Core package internals can use conventional `src/domain` and `src/application`
  structure without introducing extra workspace hierarchy.

### Negative / trade-offs

- The migration touches many physical paths while intentionally preserving
  behavior and public contracts, producing a broad but mostly structural diff.
- Repository-owned scripts, CI workflows, Docker/build contexts, TypeScript
  configuration, lint/test configuration, documentation links, and other path
  assumptions must be inventoried and updated.
- Related adapters will rely on naming and architecture documentation for visual
  grouping rather than parent-directory nesting.
- Git rename detection and review tooling may not always preserve an obvious
  file history across large moves.

## Target and synchronization

**Approved target affected:** Work #16 is authorized to implement a package-first
workspace topology in which each direct workspace child of `packages/` is an
actual package root; cohesive core packages keep domain/application structure
below their own `src/` directory.

This decision was explicitly accepted by the project maintainer on 2026-08-30.
Acceptance authorizes the structural target but does not make it Current Truth
before the migration is effective.

**Current-state owners to synchronize when the decision becomes effective:**

- `docs/architecture/overview.md` for the implemented monorepo map and physical
  architecture;
- `docs/architecture/packages.md` for package paths and package/public API current
  truth;
- `docs/architecture/dependency-rules.md` only where path examples or import
  guidance refer to obsolete physical locations, without changing dependency
  semantics;
- other repository-owned path documentation when implementation makes those
  references obsolete.

The current-state owners must not present this topology as effective before the
migration is implemented.

**Implementation / migration implications:**

- migrate nested workspace package roots to direct children of `packages/` while
  preserving package names and public exports;
- move production source of cohesive core packages below `src/` where needed;
- flatten private tooling packages covered by Work #16;
- constrain pnpm workspace discovery to the intended direct package-root depth;
- update path-sensitive build, test, lint, typecheck, CI, Docker, composition,
  migration, tooling, and repository documentation references;
- remove obsolete grouping directories and stale path references;
- validate the expected package set, workspace dependency resolution, public
  exports, and applicable build/typecheck/lint/test boundaries;
- perform Architecture Review against the dependency rules and this ADR before
  completion.

Acceptance of this ADR authorizes the structural target; it does not by itself
make the target current architecture or authorize unrelated cleanup.
