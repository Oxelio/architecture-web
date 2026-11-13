# Technical Design — CI-driven Work integration

**Artifact status:** Implemented in part

**Content status:** Current behavior, accepted target, and historical rationale

**Document type:** Technical Design

**Work:** [#91](https://github.com/Oxelio/architecture-web/issues/91)

## Scope and owners

This Governance Change / Complex Work extends the existing `delivery-automation`
package and its GitHub Actions workflows. It has no product behavior scope. The
[Project Method Profile](../project/project-method-profile.md) identifies the
adopted Method and the human governance authority. The
[delivery profile](../project/delivery-pipeline.md) owns lifecycle, role permissions,
the required checks and release separation. [Testing and verification](../development/testing.md)
owns evidence requirements. The operational sections below describe the verified
native path. The delegated publisher sections retain historical design rationale
and constraints for the accepted standing-delegation target.

The maintainer [accepted the governance target in Work #91](https://github.com/Oxelio/architecture-web/issues/91#issuecomment-6633272317).
The approved standing principal is a trusted control workflow on protected
main in repository 1336937640. Its scope is ordinary eligible Work and the
native squash auto-merge request. Standing delegation remains inactive.
The candidate-specific native path was verified on [PR #94](https://github.com/Oxelio/architecture-web/pull/94)
and [PR #103](https://github.com/Oxelio/architecture-web/pull/103). Conditional
closure succeeded for [Work #93](https://github.com/Oxelio/architecture-web/actions/runs/42189090779)
and [Work #91](https://github.com/Oxelio/architecture-web/actions/runs/42190641824).

## Work #115 implementation and validation sequence

The [maintainer decision for Work #115](https://github.com/Oxelio/architecture-web/issues/115#issuecomment-6828197659)
accepts an inactive implementation followed by normal Validation. Readiness
establishes design feasibility, ownership and authority, and the validation and
rollback plan. The separate live pilot previously proposed during Preparing is
superseded. Standing publication and native auto-merge remain inactive by
default. The current protected manual path remains effective through the
authorized cutover.

The target uses one controller on protected main and one candidate-bound
request contract. A request identifies the repository, Work, PR, head, base,
evidence and authority context. The controller reads current authority and
candidate evidence before any effect. Its proposed private GitHub App is
restricted to this repository. Keep required check publication in the separate
checks-only issuer and Project reads and writes in their own protected
credentials. No installation, ruleset, permission or activation change follows
from accepting this design.

A successful Repository CI event wakes the read-only request workflow. The
controller separately resolves the owning Work and checks the active Project
classification, GitHub Issue characteristics and complete PR file inventory.
The impact assessment is tied to the Work, PR, head, base, classification and
sorted paths, including both sides of a rename. The assessment must come from
an applicable accepted review. An absent, outdated or manual-only assessment
prevents standing publication. Changes to GitHub configuration, project policy,
ADR records, delivery automation, agent instructions or submodule
configuration stay on the protected manual path. The impact review remains
responsible for detecting sensitive changes outside these paths.

Before arming a native request, persist the exact reservation and the pending
required check identity. Verify the arm and complete that same App-owned check
only after the applicable protections and independent writers are verified.
For an invalidating write, stop further arms and releases and wait until the
prior native request is conclusively resolved. Treat ambiguous GitHub responses
as unresolved. A previously passing check cannot authorize another attempt
against stale evidence. The
[emergency administrator exception](https://github.com/Oxelio/architecture-web/issues/115#issuecomment-6827728442)
is limited to the human administrator-only access path outside agent reach.

During Validation, prove pending-check, native-arm and same-check release on
the effective protected configuration. Cover exact candidate identity, stale
checks, direct ordinary writer denial, conflicting writes on both sides of
check release, uncertain responses, revocation, and rollback. Confirm an
eligible native squash and its downstream events without routine maintainer
steps. Activation requires those proofs and the applicable separate authority.
For rollback, stop arming, resolve or quarantine the outstanding request, and
use the protected manual exception. Preserve the existing required checks.

### Writer boundary and activation evidence

The Validation record must identify which credential or native GitHub control
covers each writer below. A deployment variable or a successful evaluation
cannot establish the writer boundary.

| Merge input                                                                  | Writer to account for                                                                    | Required verification before standing activation                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work State, Work Type, Workflow Depth, Project membership                    | Projects MCP, Project automations, trusted Project writers, and direct UI access         | Deny ordinary direct writes. Verify authorized writes use the controller when they affect its reservation. Exercise the active Work Completion workflow against a different reserved candidate and a shared dependency. |
| Tasks, dependencies, Work characteristic labels, review and decision records | Issues and PR credentials, evidence authors, and workflows that can change these records | Include creation, edit, removal, close and reopen where they can change the result. Prove exclusion or mediation across the full reservation window.                                                                    |
| Owning PR and native merge state                                             | PR editors, branch writers, the manual integration path, and controller App              | Verify head, base and PR identity, and prove an independent request or direct squash cannot consume the standing check.                                                                                                 |
| Required checks and protected refs                                           | Checks-only issuer, workflow credentials, controller App, ruleset administrators         | Verify accepted App and installation bindings, effective checks and restrictions, and exclusive creation of journal refs. Verify who can change or remove those refs.                                                   |
| Standing delegation and revocation                                           | Protected control configuration and its privileged writers                               | Stop new arms. Reconcile the existing request before applying a revocation or another invalidating write through the ordinary controller path.                                                                          |

Keep emergency GitHub administration on the maintainer-only path. The merge
identity must stay without repository administration write access. An
independent administrative observation can verify bypass metadata, which
GitHub omits from ordinary read responses. To use that observation in the
controller, bind it to the effective ruleset and enforce the writer boundary
for subsequent rule changes. A missing binding leaves standing integration
disabled.

For cancellation after check release, a successful disable response or a null
auto-merge request does not establish that a squash already in progress was
prevented. Until the effective GitHub configuration yields conclusive evidence,
keep the write deferred. A verified squash is handled by the recovery path.

## Delegated request identity

The integration request identifies the repository, Work, PR and evaluated head
and base. These identifiers locate the target. Authentication comes from the
trusted invocation. For a GitHub Actions adapter, use GitHub's original dispatch
actor ID and repository ID from the workflow context. Bind that actor to an
explicit, maintainer-approved principal and Work scope. An approved service
identity must have a verifiable binding to its execution route. A shared identity
is usable only if a trusted caller can attest the individual route and scope.
Labels, PR authorship, input actor names and agent claims are routing or context
data. They supply no authentication or delegation.

The publisher reads the effective delegation again before executing the request.
An unknown actor, revoked grant, ambiguous binding or out-of-scope Work fails
closed. Use a fresh authenticated dispatch for a new mutation after a failure.
The recovery path may read an existing outcome. Actions reruns inherit the
original actor's privileges and are unsuitable for granting fresh authority.
The trusted job runs from the protected control revision and keeps its
credentials outside candidate code. Record the verified principal and request
context with the run. Keep review results and human decisions with their
existing owners.

**Decision for the maintainer:** approve the dispatch principal, its
authentication path and its delegated Work scope. One trusted GitHub identity
is sufficient when it identifies the approved execution scope or when the
trusted launcher supplies that binding. A separate identity is useful only
where it gives needed isolation. Until a binding is verified, the publisher
cannot infer which agent invoked it.

## Gate and integration race handling

Reuse the Work Integration PR resolver and the Work Merge Gate. Resolve a
single open PR into `main`, read the native Project Work State and reread the
current candidate before returning a positive result. Draft PRs continue to
receive CI and remain ineligible for integration. The first increment rejects
Drafts and detects a closed or retargeted PR during the existing live gate read.
That observation has no required-check enforcement.

The publisher evaluates the Work in `Validating` against the applicable review,
authority, Task, dependency and Working Decision owners. The initial
implementation accepts a grant only from its trusted caller. The grant binds
the authenticated actor and repository IDs to a Work and PR, the applicable
evidence references, and the verified integration modes. It is not supplied
by the integration requester. The publisher rereads the grant before writing.

The proposed narrow pilot adapter reads candidate-bound records from existing
Work or PR comments. The trusted grant identifies each applicable record, its
perspective or decision, and the responsible actor. The verifier compares the
GitHub comment and author IDs and reads the current result, including edits or
deletion of the selected record. A record explicitly identifies its `kind`,
`decision`, `workNumber`, `pullNumber`, `headSha` and `baseSha`. Use direct
human attribution for human-only decisions. The pilot must verify that the
recording channel preserves author and revocation semantics. Record formats
or applicability rules outside this bounded adapter require a verified owner.

The publisher consumes CI results from their existing providers. It verifies
that the active, strict ruleset requires both CI checks and the Work Merge
Gate with the expected applications. Gate publications include the Work, PR,
head and base in their check identity. A candidate match and app ID do not by
themselves isolate a publisher that shares its app identity with untrusted
workflows. Confirm isolation before accepting that app in the live pilot.
An already eligible PR uses the synchronous
[GitHub squash endpoint](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request)
with the evaluated head SHA. A PR waiting for GitHub-enforced checks can use
[native auto-merge](https://docs.github.com/en/graphql/reference/pulls#enablepullrequestautomerge)
with `expectedHeadOid` and `SQUASH` after the other conditions are established.
Both paths keep the existing ruleset protections. The publisher records the
GitHub result and rereads the PR after a conflict or uncertain response before
considering a new request.

For the maintainer-authorized native auto-merge demonstration, both CI checks
passed before the native request was armed. The evaluated Work Merge Gate
was the final pending required check. The candidate was bound to its reviewed
head and current base, and GitHub performed the squash after publication.

GitHub enforces the protected target's rules at merge time and the direct
endpoint compares the head SHA. The endpoint does not condition the merge on
the PR base ref read by the publisher or on Project or approval data. Auto-merge
may execute after the initial request. Test both candidate replacement and
retargeting while a request is armed. A review revocation, Work State change or
reopened dependency can invalidate a check without changing the commit. A final
read or asynchronous check invalidation leaves a race.

For the first direct-merge pilot, inspect every writer of the PR target and the
required external facts for the selected Work scope. Reuse the trusted publisher
as the single serialized path for changes it already controls. A prerequisite
with an independent writer remains a blocker unless GitHub protects the
condition at merge time or the project can demonstrably exclude the invalidating
write for the merge window. Auto-merge needs that guarantee for its entire wait.
Draft remains a review-readiness signal. The fallback is explicit integration
authority with a fresh decision once the prerequisite is stable. If stability
cannot be established, defer the merge.

**Decision for the maintainer:** if the writer inventory reveals a bypass of
this boundary, accept a targeted restriction on that write path or keep the
affected integration mode inactive. The design introduces no global coordination
protocol for Project or approval changes.

## Post-merge event delivery and closure

Choose the smallest repository-scoped credential that can stay inside the
trusted publisher and produces downstream events. A GitHub App installation
token is an option when the existing credential cannot meet those conditions.
The workflow's built-in `GITHUB_TOKEN` can suppress `push` and
`pull_request.closed` runs. Verify both event paths
separately for direct squash and native auto-merge. For each authorized pilot,
match the integrated SHA to the push-triggered validation and source-release
planning runs and match the PR to the closure run. Publication remains subject
to the existing source-release policy. A test does not require a release for a
candidate that yields a no-release plan.

The closure workflow resolves the merged PR and its Work from GitHub, verifies
the integrated candidate and reads the Done evidence. It writes `Status = Done`,
rereads the Project item, then closes the Issue as `completed`. Serialize
attempts by Work. Keep a trusted `workflow_dispatch` recovery by PR number.
Recovery rereads the merge, disposition and evidence and can finish a partial
closure. It does not infer missing post-merge evidence. If the pilot shows a
missing automatic event for a merge mode, that mode stays inactive until a
verified event path is available.

## Historical increment and activation boundaries

1. Clarify optional Projects MCP usage and harden the existing read-only gate
   evidence. Verify the live-reader regression cases and documentation links.
2. After the principal and writer boundary are resolved, implement a trusted
   integration request and conditional closure without changing repository
   enforcement. Verify wrong principal, stale or revoked delegation, wrong
   repository, head/base races, repeated requests, GitHub refusal, missed
   events and partial closure in fixtures and explicitly authorized live cases.
3. Record live evidence for the required check and each integration mode before
   operational activation. The maintainer accepts the governance scope
   separately from the administrator's changes to the ruleset or merge settings.
   The Work remains open while its required activation evidence is outstanding.

The second increment implements the integration publisher and the conditional
closure sequence in `delivery-automation`. The publisher requires a trusted
grant reader and a verified execution boundary that covers the entire merge
window for the chosen mode. The closure sequence requires a trusted reader
that resolves the confirmed `main` merge, its unique Work and the Done evidence,
plus serialized writes to the two existing owners. The delegated publisher was
verified against fixtures. The native candidate-specific
workflow and conditional closure were subsequently verified on GitHub.

The observation workflow exercises the publisher's reads and decisions without
executing a mutation. It only accepts a fresh dispatch on `main` and checks out
the control workflow SHA. The initial requester is the authenticated maintainer
`Oxelio`. The workflow checks the GitHub actor against the repository owner, then
verifies its numeric identity against the Project owner. This proves a maintainer
dispatch for observation and supplies no identity binding for a Codex route.

The pilot operator configures `delivery-integration-observation` to allow only
`main` before setting `DELIVERY_OBSERVATION_PROJECTS_TOKEN` to a credential with
read access to Project #3 and its linked Work Issue. Store it only in the
protected environment. The built-in workflow token reads repository evidence
with explicit read permissions. The Projects query reads the requested Issue's
Project item and `Status`. It avoids a Project-wide inventory.

Set `DELIVERY_OBSERVATION_GRANT` in the protected environment with the verified
GitHub actor and repository IDs, one Work/PR pair, the allowed observation modes,
the expected gate App and ruleset IDs, and the applicable evidence and Task
references. The initial actor ID is `83680141`, the repository ID is
`1336937640`, and the existing ruleset ID is `21839336`. Select a pilot Work/PR
separately from the governance PR for Work #91. Verify the gate App ID against
the check actually published by the trusted run before setting the grant.
Dispatch with that Work and PR, the current head and base SHAs, and one mode.
For direct observation, require both CI checks to have succeeded. For
auto-merge observation, at least one CI check must still be pending and the
candidate-bound observation gate must have succeeded. Verify that missing,
revoked or wrongly attributed evidence and a check from an unexpected App fail
closed. The existing ruleset remains in effect throughout observation.

The manual gate publishes a separately named observation check. The observation
workflow checks its issuer and candidate identity without requiring that check
in the ruleset. A positive result establishes neither writer exclusion nor merge
authority. GitHub can omit `bypass_actors` from a read-only ruleset response.
Observation reports that omission as `bypassActors: "unverified"`. Mutation
requires an explicitly empty list. An explicit bypass or altered protection
blocks observation as well. For the later mutation pilot, verify separately that an isolated
publisher can issue the required gate, that freshness holds for each mode, and
that each actual merge triggers the downstream runs described above. Use an App
only if the verified permission or event behavior requires one.

### Direct squash pilot adapter

The [scoped decision](https://github.com/Oxelio/architecture-web/issues/91#issuecomment-6644521094)
authorizes preparation and non-mutating validation for the Codex connector
channel. The request workflow authenticates a new PR comment on trusted
`main`. Use a first line of `/architecture-web direct-squash` followed by a
JSON object with `workNumber`, `pullNumber`, `headSha`, and `baseSha`.
GitHub-authored metadata must identify repository `1336937640`, author
`83680141`, and app `1144995`. Authorship through the connector grants no
human-only decision authority.

`DELIVERY_DIRECT_GRANT_COMMENT_ID` identifies a separate, unedited maintainer
record posted directly on Work #91. The JSON record binds the same candidate,
`actorId`, `appId`, `repositoryId`, `operation: "direct-squash"`, and an
`expiresAt` timestamp. The adapter rereads that record. Editing or removing
the record revokes it. The listener has read-only permissions and never calls
the merge publisher. A future mutation composition must bind one authorized
invocation and keep the existing fail-closed writer boundary and check
verification. An Actions rerun is ineligible; that guard alone is not
cross-run replay prevention for a privileged operation.

Use a dedicated gate issuer if the installed app inventory shows no issuer
reserved for this check. Register a private GitHub App with its webhook
disabled. Install it only on this repository and grant `Checks: write` and
the default `Metadata: read`. Keep the private key in a protected environment
restricted to `main` and the trusted publication job. Record its app ID and
prove that an unrelated workflow cannot issue the accepted check. The squash
publisher takes a separate credential with `Contents: write` scoped to this
repository. It uses its read credential for verification and the merge
credential only for the native mutation. Verify ruleset bypass metadata
separately; unavailable metadata still blocks mutation.

### Conditional Work completion

The `Delivery Work Completion` workflow starts on merged Work Integration PRs
targeting `main` when the repository variable `DELIVERY_COMPLETION_ENABLED` is
`true`. It reads the owning Work from the PR's `Refs #<work>` line and runs
from trusted `main` code. The `delivery-work-completion-pilot` environment
allows only `main` and stores the personal Project write credential in
`DELIVERY_COMPLETION_PROJECTS_TOKEN`. The job uses repository `Actions: read`
to verify downstream runs and `Issues: write` to close the owning Issue.

A direct, unedited maintainer JSON comment on the owning Issue records
`kind: "work-completion"`, `workNumber`, `pullNumber`, `headSha`, `baseSha`,
`mergeSha`, and the established completion predicates `scopeConcluded`,
`reviewsAccepted`, `validationSufficient`, `durableOwnersSynchronized`,
`workingDecisionsResolved` and `postMergeObligationsSatisfied`. The publisher
independently checks the squash on `main`, native Project membership,
Issue disposition, required Tasks, dependencies and successful push-triggered
CI and source-release processing for the merged SHA. It verifies
`Status = Done` before closing the Issue as completed. An eligible
`issue_comment.created` event starts recovery when the maintainer
publishes that record after merge. The job groups attempts by PR, rereads the
comment through the API and rejects an edited, app-authored or mismatched record.
Automatic runs wait up to six minutes for downstream workflows and retry an
previously attempted Issue closure at most twice when its read-back is inconclusive. A maintainer
can dispatch a fresh run
with `pull_number` if the automatic window expires.

For this user-owned Project, retain the verified personal token with `project`
scope. To rotate it, create a replacement with an expiry, verify access to
Project #3, replace only the completion environment secret, verify an eligible
closure run and revoke the old token. The Gate App token and repository workflow
token remain separate.

### Evaluated Work Merge Gate

`delivery-work-evaluated-gate.yml` is enabled with the repository variable
`DELIVERY_EVALUATED_GATE_ENABLED`. The `delivery-work-gate-issuer` environment
allows only `main` and uses `DELIVERY_GATE_APP_ID`,
`DELIVERY_GATE_APP_CLIENT_ID` and the environment secret
`DELIVERY_GATE_APP_PRIVATE_KEY`. The dedicated App `5625775` issues
`Architecture Web / Work Merge Gate` using a short-lived token with
`Checks: write` for this repository. The ruleset requires this exact issuer,
along with the existing CI publishers.

The separate evaluation job uses the protected
`delivery-integration-observation` environment. Set an expiring
`DELIVERY_EVALUATED_GATE_EVIDENCE` record for the exact authorized candidate.
Include the evaluation purpose `evaluate-work-merge-gate`, repository, actor,
Work and PR IDs, both SHAs, ruleset and App IDs, expiration, required Task IDs,
and the required evidence kinds and their attributable comment references.
Dispatch the workflow from `main` with `work_number`, `pull_number`,
`head_sha` and `base_sha`. The record authorizes evaluation. The workflow
verifies the candidate, Work state, applicable evidence and the two existing
CI publishers before publishing the result for that head and base.

[PR #94](https://github.com/Oxelio/architecture-web/pull/94) verified native
squash auto-merge with the evaluated Gate as the final required check. The
[Gate run](https://github.com/Oxelio/architecture-web/actions/runs/42186121466)
and the recorded integration evidence are linked from
[Work #91](https://github.com/Oxelio/architecture-web/issues/91#issuecomment-6680412784).
[Work #102](https://github.com/Oxelio/architecture-web/issues/102) records the
closed, `not planned` disposition of custom delegated direct squash.

Direct squash consumes the Work/PR/head/base tuple by creating a lightweight
Git reference in `refs/tags/delivery-direct/`. It requires HTTP 201 and
verifies the returned reference and commit SHA. Conflicts, ambiguous responses
and unexpected objects stop before the squash call. This does not need another
credential beyond the isolated repository `Contents: write` token. The
publisher never updates or deletes the receipt and does not retry a consumed
candidate after an uncertain result. Reconcile the PR, receipt and main
before any separately authorized recovery. These are operational receipts;
the source release workflow only triggers on pushes to main. Before live use,
verify create-only behavior on a disposable ref and ensure no independent
writer can delete the receipt or change an external prerequisite during the
entire read, reservation and squash window.

For the bypass check, a maintainer can independently read ruleset
`21839336` from an administrative session, recording its ID, target,
conditions, enforcement, rule parameters and an explicitly empty
`bypass_actors` list. Use that observation to verify the baseline and the
proposed ruleset diff. A read-only omission is insufficient. Runtime use of
an independent administrative evidence path requires an accepted binding to
the effective ruleset and a verified exclusion of ruleset writes. The merge
credential itself must not receive `Administration: write`.

For the closure test, record the current native
[Auto-close issue](https://github.com/users/Oxelio/projects/3/workflows/111737365)
setting and its `Done` trigger. In a separately authorized window, suspend
other completion writers, turn off that one workflow and verify that it is
off before writing Done through the publisher. After verifying the Issue
readback or aborting before any closure mutation, restore the original setting
and verify it. If Done was written but closure is unconfirmed, reconcile that
Work first. Restoring the workflow is not a substitute for the recovery
dispatch. Leave all other Project automations unchanged.
