# ADR-0009 — Group workspace packages by architectural responsibility

**Status:** Accepted
**Content status:** Canonical
**Document type:** Architecture Decision Record
**Domain:** Workspace / package topology
**Supersedes:** [ADR-0007](0007-package-first-workspace-topology.md)

## Context and authority

Work #16 delivered ADR-0007's flat topology. A later implementation grouped
packages by architectural responsibility without an accepted successor. That
implementation alone did not supersede ADR-0007.

On 2026-11-01 the maintainer selected the current IAM-based grouped organization
in the cross-context architecture review, requested its successor ADR and
authorized implementation of that remediation plan. This records the bounded
topology choice, without accepting unrelated architecture exceptions.

## Decision

Keep context packages under `packages/contexts/*`, specialized adapters under
`packages/adapters/*/*`, generic primitives under `packages/shared/*` and tooling
under `packages/tooling/*`. Applications remain under `apps/*`. Workspace
discovery enumerates these explicit patterns, not an unbounded recursive glob.

Manifests, exports and dependency rules remain the package boundaries. Directory
containment grants no access to context internals. Domain and application remain
separate responsibilities inside each cohesive context package. Infrastructure
depends inward on public contracts.

## Alternatives and consequences

Restoring the flat layout would recover uniform root depth but require another
physical migration without improving model ownership. The selected groups
preserve current navigation and tooling, at the cost of several explicit root
depths. Discovery and boundary tests must validate these patterns and exports.

No package identity, public contract, product behavior, publication policy or
bounded-context ownership changes merely because this topology is accepted.
ADR-0007 remains rationale for the earlier completed migration.
