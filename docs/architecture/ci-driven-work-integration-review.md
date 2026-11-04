# Work #91 — Increment review

**Work:** [#91](https://github.com/Oxelio/architecture-web/issues/91)

**Reviewer:** Codex, acting as Code Reviewer and then as Software Architect

**Candidate:** local changes on `codex/91-delivery-governance` against
`937fa6ae95904575d16d54080f7421be80cd2a92`

**Working tree fingerprint:** `01f3293d8c3c3fc86d74f9266c5ffccabf2808efd3095172b68c328375a50502`

The fingerprint covers the base commit and the sorted paths and SHA-256 digests
of modified and untracked files before this review record and workflow wiring.
This record covers a local candidate and does not represent a PR approval or an
activation decision.

## Code Review

- The manual observation path could publish under the name reserved for a
  required gate, despite using manually supplied assertions. Its publisher now
  accepts only the observation check name.
- The squash could inherit closing references that would close the Issue before
  the conditional completion checks. Both modes now verify that the PR has no
  native closing links and supply a non-closing commit body. The publisher also
  rejects a closing headline.
- The before/after delegation comparison now uses an independent snapshot. The
  existing closure readback and retry retain the Work state and Issue ownership
  separation.

**Conclusion:** Accepted for the reviewed local candidate. The focused suites
passed 48 tests, including the closing-link and closing-headline regressions.

## Architecture Review

Reviewed the [Technical Design](ci-driven-work-integration.md),
[delivery profile](../project/delivery-pipeline.md) and
[dependency rules](dependency-rules.md). The integration adapter remains in
`delivery-automation`. The agent request identifies a candidate and supplies no
grant, role result or verified execution boundary. The publisher obtains those
from its trusted composition. Project `Status` and the Issue retain distinct
owners. The design treats candidate freshness, gate emitter isolation and
downstream events as separate operational evidence.

**Conclusion:** Accepted for the reviewed local candidate and read-only
observation wiring. Privileged operation remains an activation blocker until
the principal and grant source, the writer boundary, the isolated check emitter,
and downstream event delivery are verified. Neither a final read nor Actions
concurrency establishes a lock on external writers. The accepted maintainer
governance target remains unchanged.

## Observation workflow follow-up

**Candidate fingerprint:** `5bd0b8942692cbb6af023995adfbc3f0897f78f7aadb46d1e731e70c2baf297e`
(same base and procedure, excluding this review record).

- **Code Reviewer:** Accepted the observation adapter for this candidate. The
  CLI rejects reruns and dispatches outside the trusted revision. Both modes
  exercised the publisher's real verification path with zero mutations in
  fixtures. All 52 focused tests passed.
- **Software Architect:** Accepted the read-only wiring. The workflow checks out
  its control revision and has only read permissions. Protect the observation
  environment for `main` before provisioning its read-only Projects credential.
  The grant is operator configuration, separate from requester inputs. The live
  publisher, required check and both merge modes remain subject to the pilot
  criteria in the Technical Design.

## Governance PR candidate

**Candidate fingerprint:** `4c9bcc2b4232239c3af3022cd9741da04162e26116fa8dba8ebdae9f94541f51`
(same base and procedure, excluding this review record).

- **Code Reviewer:** Accepted the full governance PR candidate. Reassessed the
  earlier gate, squash and closure fixes and reviewed the changes since the
  observation review. The observer verifies the authenticated maintainer and
  reads the requested Work's native `Status`. The observation gate name and its
  acceptance path are separate from those used for mutation. The 26 package
  suites passed, with 214 tests passing and 2 skipped. TypeScript, documentation
  links and the whitespace check passed.
- **Software Architect:** Accepted the governance PR candidate for integration
  under the effective merge rules. The observation workflow runs trusted
  `main` code with read permissions. Its protected environment must be configured
  before provisioning credentials. The approval in Work #91 authorizes the
  governance target. The maintainer's observation dispatch identifies a human
  requester and supplies no Codex delegation. Live gate issuer isolation,
  external prerequisite stability and downstream workflow delivery are still
  operational acceptance criteria for each mutation mode.

## Coverage follow-up

**Candidate:** Test-only follow-up to
`235b3453a4ebaa955795120a235c8295e1d396bb`.
The reviewed CLI test file has SHA-256
`8047aee4209ea0257dc6e8367e7588aa78763b5b89501baf8bc282bf8dc73168`.

- **Code Reviewer:** Accepted the new cases for mismatched login, mismatched
  numeric identity, invalid mode and a valid maintainer dispatch with a
  mismatched PR. The tests verify the separate read credentials and exact
  request scope. All 53 focused tests, TypeScript and targeted lint passed.
- **Software Architect:** Accepted the test-only follow-up. It exercises the
  existing boundary without changing the identity model, permissions, or
  operational activation requirements.
