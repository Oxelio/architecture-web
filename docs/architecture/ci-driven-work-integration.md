# Technical Design — CI-driven Work integration

**Artifact status:** Proposed

**Content status:** Proposed

**Document type:** Technical Design

**Work:** [#91](https://github.com/Oxelio/architecture-web/issues/91)

## Scope and owners

This Governance Change / Complex Work extends the existing `delivery-automation`
package and its GitHub Actions workflows. It has no product behavior scope. The
[Project Method Profile](../project/project-method-profile.md) identifies the
adopted Method and the human governance authority. The
[delivery profile](../project/delivery-pipeline.md) owns lifecycle, role permissions,
the required checks and release separation. [Testing and verification](../development/testing.md)
owns evidence requirements. This design proposes implementation mechanisms and
records open decisions for those owners.

The maintainer [accepted the governance target in Work #91](https://github.com/Oxelio/architecture-web/issues/91#issuecomment-6633272317).
The acceptance covers the target policy for explicitly delegated ordinary Work.
The concrete principal, grant scope and verified activation remain separate.

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

The initial publisher requires a successful Work Merge Gate even when native
CI checks are pending. The current manual gate evaluator expects established
repository check evidence. A live auto-merge pilot must demonstrate a real,
safe pending-CI case with valid gate evidence or leave that mode inactive.

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

## Increment and activation boundaries

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
plus serialized writes to the two existing owners. These components currently
run against test fixtures. Live workflow composition and operational activation
depend on verification of those bindings and the downstream events above.

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
authority. For the later mutation pilot, verify separately that an isolated
publisher can issue the required gate, that freshness holds for each mode, and
that each actual merge triggers the downstream runs described above. Use an App
only if the verified permission or event behavior requires one.
