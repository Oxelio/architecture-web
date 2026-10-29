# Technical Design — Automatic coordinated releases

**Artifact status:** Accepted target\
**Content status:** Proposed\
**Document type:** Technical Design\
**Work:** [#58](https://github.com/Oxelio/Architecture-Web/issues/58)

## Owners and context

The [Method profile](../project/project-method-profile.md) adopts gitlink
`703051af50189a70399d82c82ca0f2b17c35f998`. The
[delivery profile](../project/delivery-pipeline.md),
[ADR-0008](decisions/0008-main-only-automatic-releases.md),
[package contracts](packages.md) and [validation policy](../development/testing.md)
are authoritative. The accepted maintainer instruction and #58 establish scope.
No product behavior is intentionally changed; existing HTTP paths must survive.

Classification: Governance Change / Complex, with operational, cross-system,
security, concurrency and migration characteristics. Roles: governance analysis
and architecture design, then Technical Planner, Developer, distinct review and
validation activities. Project Status is not inferred from this document.

## Design and execution units

1. Synchronize the policy owners and retire staged-release entry points. Preserve
   ordinary Work Merge Gate semantics, selecting PRs into `main`.
2. Implement a pure, parser-backed version policy; read immutable Git history and
   tags; use release-it to generate notes and coordinated manifests in isolation.
   Archive tracked sources and the pinned Method submodule deterministically.
3. Separate read-only validation/generation from a trusted privileged publisher.
   Validate payload identity, checksums, tag conflicts and first-stable authority
   again before publication. Serialize releases and resume incomplete publication.
4. Review and validate the transition PR, preserve ancestry, then separately
   verify live publication and branch conservation before cleanup.

These are sequenced execution units within #58, not substitute operational Task
identities. Project and Sub-issue mutations are not available through the current
connector; their absence is surfaced rather than inventing a competing tracker.

## Readiness assessment

The accepted plan resolves version ownership, source-only distribution, the
explicit downgrade, HTTP compatibility, branch topology and release authority.
No developer decision is required on these subjects. Implementation readiness:
READY for this bounded implementation. Platform activation and human-supplied
pre-merge validation remain transition prerequisites; no Project Status or merge
authority is manufactured by this assessment.

## Verification and recovery

Tests cover policy examples, parser forms, no-release changes, unexpected
prereleases, explicit first-stable authorization, source identity, deterministic
archives, dependency preservation, tag-only remote pushes, partial publication
and conflicting assets. Full repository checks and documentation links supplement
targeted suites. Current pre-merge human validation ownership remains applicable;
automated release validation is authorized only for the release boundary.

A tag and its immutable publication metadata identify the same candidate across
reruns. Never move/delete tags or overwrite differing assets. Source/version
generation runs without publication credentials. The publisher executes trusted
control code and consumes the already-validated source candidate and artifacts.
