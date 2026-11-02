# Technical Design — Pull request metadata validation

**Artifact status:** Accepted technical target

**Content status:** Proposed

**Document type:** Technical Design

**Domain:** CI / Delivery tooling

## Work and authority

[Work #89](https://github.com/Oxelio/architecture-web/issues/89) is a
Technical Change / Complex. The accepted scope preserves the
[delivery policy](../project/delivery-pipeline.md#required-checks-on-main),
[validation policy](testing.md#candidate-bound-validation-evidence), and
[Project Method Profile](../project/project-method-profile.md). It changes no
product behavior, structural architecture rule, required-check provider, merge
authority, release behavior, or deployment behavior. No new Functional
Specification, ADR, or human governance acceptance is required by this target.

## Responsibilities and routing

The existing Repository CI workflow owns event routing. Only a pull_request
edited event whose nonempty changes contain exclusively title and/or body uses
the metadata route. Other events, base edits, and unknown changes use full
validation. The reusable workflow retains both validation jobs. Dependency
Review and the eligible Sonar job execute only on the full route.

Quality checks remains an always-running GitHub Actions job. It validates the
live PR title with locked commitlint, then verifies the applicable local results
or original full-run evidence. The title and candidate are reread immediately
before success. Missing data, changed snapshots, unsuccessful results, and
unexpected skips fail closed. Non-PR validation retains its existing contract.
Live candidate freshness uses the exact `refs/pull/<number>/merge` Git reference,
whose ref name, commit type and SHA are verified; it does not depend on the
removed `merge_commit_sha` field in REST 2026-03-10 PR responses.

Full and metadata runs use separate concurrency groups. Metadata edits cannot
cancel running or pending full validation. Superseded metadata runs may cancel
each other; full PR runs retain their existing supersession policy. A finishing
full run must validate the current title rather than its event's historical title.

## Evidence identity and provenance

The GitHub run API is not assumed to expose effective workflow_call inputs.
Each reusable PR job verifies its actual checkout against candidate_sha and
records its actual candidate_sha and comparison_base inputs before candidate
dependency installation or build execution. The primary job also verifies the
synthetic merge commit's base/head parents. Both publish one immutable JSON
identity artifact per job and run attempt using the pinned upload action.

The versioned record contains repository ID/name, PR number, head repository
ID/name and SHA, base ref/SHA, candidate and comparison-base inputs, checked-out
SHA, caller workflow ref/SHA, run ID/attempt, and job identity. The record asserts
identity, not successful validation; successful GitHub job results are required
separately. PR bodies, run-name markers, arbitrary artifact names, and a green
check on the head SHA alone are never trusted evidence.

The consumer discovers the newest full run for this PR/head, excluding itself,
then verifies its workflow identity, pull_request event, repository, latest
attempt, referenced reusable workflow revision, successful overall result, both
successful validation jobs, Dependency Review and Quality checks. Check-run
provider and suite/run association are checked. It downloads only the two exact
identity artifact IDs belonging to that run/attempt and compares every identity
with the live candidate and the source metadata. Missing/ambiguous associations
or incomplete pagination are errors. Reuse never searches past a newer full
failure/cancellation/pending run and never chains through metadata runs.

This preserves the existing trust boundary of reviewed repository workflows:
the source workflow revision is immutable and must match the current candidate;
an artifact from another revision, workflow, repository, PR, or attempt cannot
substitute. No additional credential, signing service, privileged trigger, or
check-writing permission is introduced.

## Retention, recovery, and compatibility

Identity artifacts request seven days of retention. They are small and distinct
from the one-day coverage/type-context artifacts, whose transfer remains within
the same run. Reuse also rejects source evidence older than seven days. The
consumer honors actual expiration/deletion and never refreshes original evidence
by republishing it. A lower platform retention limit may reduce availability;
it never permits acceptance without evidence. Existing runs without identity
records are ineligible.

Absent/unreadable/expired/unsuccessful evidence makes metadata validation fail
without starting expensive jobs. Recovery is Re-run all jobs on an appropriate
full pull_request run only if its original candidate/base still match, or a fresh
full PR event (reopen, or synchronize after updating the branch). Partial reruns
cannot mix identity records from different attempts. A workflow_dispatch on main
or the PR branch is not a guaranteed source of required PR checks.

The external SonarCloud Code Analysis check remains independent and is never
fabricated or republished. Fork and Dependabot credential exclusions remain.
The Work Merge Gate still requires established reviews, sufficient current
validation, applicable authorities, and its existing operational prerequisites.

## Validation and acceptance

Native Node tests exercise identity creation, evidence resolution and rejection,
event routing, title/candidate freshness, API pagination and failures. The new
quality-gate test file is explicitly included in ci:test:tooling, which both
supported Node validation jobs execute. Workflow contract tests verify routing,
permissions, artifact timing/retention, concurrency and release isolation.

The real acceptance scenario starts full validation, changes the title to an
invalid value, observes metadata Quality checks failing, then lets full validation
finish. Its Quality checks must also fail and GitHub must retain the required-check
block. Record run/check IDs, attempts, title snapshots, timing and the actual PR
check state. Repeat title correction, description edit and full recovery. Local
mocks do not establish GitHub's concurrent required-check selection semantics.
If the real scenario cannot preserve the contract, delivery is blocked; no check
or governance policy may be weakened to claim success.

## Alternatives and execution boundary

Removing edited loses title validation; a non-required title workflow cannot
invalidate required Quality checks; treating skipped jobs as successful evidence
is unsafe. Effective inputs are recorded rather than guessed from run APIs.
Only small identity artifacts cross runs; build outputs and coverage do not.

Implementation, tests and documentation form one bounded execution unit under
one implementer, so no artificial Task Sub-issues are required. Code Review and
CI/security contract review precede validation acceptance. The focused Context
Manifest and formal Readiness result are recorded in the Work's operational
discussion, referencing this technical target and canonical policy owners.
