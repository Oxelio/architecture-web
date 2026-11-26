# Technical Design — CI-driven Work integration

**Artifact status:** Superseded

**Content status:** Historical rationale

**Work:** [#91](https://github.com/Oxelio/architecture-web/issues/91),
[#115](https://github.com/Oxelio/architecture-web/issues/115),
[#156](https://github.com/Oxelio/architecture-web/issues/156)

[Work #205](https://github.com/Oxelio/architecture-web/issues/205) retires this
design's custom Work Merge Gate, candidate-specific gate-mediated auto-merge,
standing delegation, controller and journal, and coordinated Project Status and
completion publishers. The [delivery profile](../project/delivery-pipeline.md)
owns current integration and lifecycle policy. The
[pre-retirement design](https://github.com/Oxelio/architecture-web/blob/f9dc24dd66eee6657ab9f3d9f4af86c6abd128c9/docs/architecture/ci-driven-work-integration.md)
preserves the full historical record.

## Original decisions and evidence

Work #91 used GitHub-native squash auto-merge for candidates explicitly
authorized by the maintainer. A dedicated checks-only issuer published the
evaluated Work Merge Gate for the exact head and base after verifying Work
ownership, applicable reviews, validation, approvals and required checks. The
gate acted as the last required check. [PR #94](https://github.com/Oxelio/architecture-web/pull/94)
and [PR #103](https://github.com/Oxelio/architecture-web/pull/103) verified the
candidate-specific path. The read-only integration observation and observation
check gave evidence without granting merge authority.

The approved standing target used a separate restricted controller and
revocable delegation. Work #115 added durable reservations and ordered final
check admission against revocation. When a write was uncertain, the controller
needed positive outcome evidence before releasing the reservation. Work #156
accepted a final verified snapshot of mutable Issue, Project and PR metadata for
that target because GitHub provides no lock spanning those owners and native
merge. Standing delegation remained inactive.

Project Status and conditional completion shared the controller boundary and
journal. The completion pilot kept Issue closure conditional on exact
integration, accepted Work evidence, downstream CI and source-release processing,
and verified Project Status. The source-release workflow planned and processed
immutable source independently of the integration controller.

## Retirement

Work #205 uses ordinary native squash integration with candidate-specific human
authority for agent merges and reserves lifecycle recording for authorized
native Project and Issue operations. GitHub's required checks and the
Software Engineering Method gates retain their respective responsibilities.
The [cutover and validation plan](https://github.com/Oxelio/architecture-web/issues/205#issuecomment-7178508912)
records the administrative sequence and the evidence required for live workflow
retirement.
Historical receipts, refs and audit evidence remain subject to their owning
retention rules.
