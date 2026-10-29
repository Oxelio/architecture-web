# ADR-0008 — Main-only integration and coordinated automatic releases

**Status:** Accepted\
**Content status:** Canonical\
**Document type:** Architecture Decision Record\
**Domain:** Delivery / versioning

## Context and authority

Work [#58](https://github.com/Oxelio/Architecture-Web/issues/58) coordinates this
change. The maintainer explicitly requested implementation of the complete revised
plan on 2026-10-29, accepting its governance and structural decisions. This accepts
the target; repository merge and separately verified platform activation make it
effective. The [delivery profile](../../project/delivery-pipeline.md) owns policy.

The previous design separated development, release candidates and stable history
using branches, human release approval and Release Work Issues. There are no
published tags or GitHub Releases at adoption. All 24 manifests declare
`1.0.0-alpha.1`; that declaration has never established a publication contract.

## Decision

Use one permanent `main` branch, temporary PR branches and automatic releases
after successful candidate-bound repository validation. GitHub Releases and their
manifests own release traceability. No per-release Work Issue, beta deployment or
routine Human Release Approval is required. Work integration reviews and gates
remain separate from release publication. The first `1.0.0` requires an explicit
human maintainer request bound to an exact source SHA.

Version the project as one coordinated unit. Published `vX.Y.Z` tags own released
versions. Tracked manifests are development declarations; generate coordinated
manifest versions in the attached source archive without release commits or
branch pushes. Keep `workspace:*`. Explicitly migrate the existing declarations
to `0.1.0`; do not silently normalize any other prerelease. HTTP contract version
`v1` is independent from project SemVer and remains unchanged.

Use release-it with Conventional Changelog and bumper. Project code supplies the
small pre-1.0 policy and deterministic authorization/artifact/publication checks.
There is no npm registry publication or independent package release.

## Alternatives and consequences

- Retaining staged branches and human release gates adds coordination that this
  source-only delivery does not require.
- semantic-release needs bootstrap and policy adaptations; release-it supports
  explicit control of file preparation independently of tag/publication effects.
- Changesets adds contributor-maintained release descriptions and package bump
  decisions alongside the chosen Conventional Commit input.
- Release commits would require branch mutation and complicate PR protections.

The generated archive differs from the raw GitHub source archive only by the
documented version/changelog transformations. Its manifest identifies the exact
source tree and checksums. Source artifacts do not claim runtime deployment
validation. Future environments can consume different SHA/tag identities from
the same branch and require their own accepted deployment design.

## Transition

Preserve the full development history through a merge-commit transition PR to
`main`. Do not force-update either branch or discard unique local commits. Delete
`development` only after ancestry verification, and other temporary branches only
after confirming that their work is integrated. No branch cleanup is implied by
merely accepting this ADR.
