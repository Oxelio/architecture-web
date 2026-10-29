# Automatic releases

Policy belongs to the [delivery profile](../project/delivery-pipeline.md), with
rationale in [ADR-0008](../architecture/decisions/0008-main-only-automatic-releases.md).

## Contributing

Create temporary Work branches from `main`, reference the owning Work in the PR,
and follow the Work Merge Gate. Use a Conventional Commit PR title for squash
merges. For breaking changes prefer `!` in the title; if using only a
`BREAKING CHANGE` footer, preserve that footer in the actual squash commit.
Merge commits are ignored as semantic inputs; their constituent commits remain
available to the analyzer. Do not rewrite history to fix old commit messages.

```bash
pnpm release:plan
```

This command reads the local checkout and reachable tags without writing files,
creating tags or using publication credentials. Its JSON names the exact SHA,
previous version and next version, or `null` when no release is warranted.

## Publication

The `Automatic coordinated release` workflow selects an immutable SHA from
`main`, calculates its version, runs the repository checks, and generates the
source archive in isolation with release-it. A separate trusted job verifies the
plan and checksums, creates an annotated tag and publishes the GitHub Release.
It never pushes branch changes or publishes npm packages.

Tracked manifest versions are development declarations, not the latest published
version. Tags own publication history. The attached source archive stamps all
discovered workspace manifests and includes generated `CHANGELOG.md`; it preserves
`workspace:*` dependencies and includes the Method submodule at its pinned
revision. GitHub's built-in source zip/tar remain raw commit snapshots. The
archive is not an executable API/web distribution.

Each release includes `architecture-web-X.Y.Z-source.tar.gz`, `release-notes.md`,
`release-manifest.json` and `SHA256SUMS`. The manifest binds the source SHA/tree,
previous tag, version, Method revision and transformations to asset checksums.

## First 1.0.0

A human repository maintainer must explicitly dispatch `.github/workflows/release.yml`
on `main` with `release_level=first-stable` and `expected_sha` equal to the dispatch
SHA. The workflow verifies a GitHub User actor with maintain/admin authority and
records the originating run. Automatic `fix`, `feat` and breaking commits cannot
produce the first `1.0.0`. The request does not skip validation. There is no
additional manual release approval after successful checks.

## Recovery

Rerun a failed workflow or dispatch `release_level=auto` on `main`. An annotated
tag with a missing/draft Release is completed before selecting a newer candidate.
The immutable tag metadata restores the original plan, including first-stable
authorization. Existing assets are downloaded and checked before any upload.
Matching releases are no-ops; different tag targets, metadata or asset bytes are
errors. Never force/delete a tag or replace differing assets to repair a failure.

Rebuilds must reproduce the source artifact checksums. Fix a reproducibility
problem through ordinary reviewed Work rather than changing the approved tag.
Publication is serialized; GitHub may coalesce pending push runs, so the next run
selects current `main` and includes all unreleased commits.

## Activation and transition

Workflow presence is implementation evidence, not proof of successful live
publication or branch protection. Work #58 must verify the first live run and
actual platform permissions separately. Preserve development ancestry in the
transition PR and delete only integrated branches. No environment or deployment
is implied by a source release; future deployment design is separate Work.
