# Technical Design — Controlled authoring and Sonar evidence

**Artifact status** Proposed technical design with inactive preparation modules

**Content status** Verified current deployment, preparation-approved target, and unresolved cutover

**Operational owner** [Task #140](https://github.com/Oxelio/architecture-web/issues/140), following completed Work #115

## Context and authority

The [bounded human decision](https://github.com/Oxelio/architecture-web/issues/140#issuecomment-6960488409)
authorizes repository-only preparation, inactive implementation after Readiness,
and non-destructive tests. The [PR #146 handoff](https://github.com/Oxelio/architecture-web/pull/146#issuecomment-6960494542)
keeps its journal probe separate. Repository 1336937640 is the only mutation
target. The [Project Method Profile](../project/project-method-profile.md),
[delivery profile](../project/delivery-pipeline.md),
[existing integration design](ci-driven-work-integration.md), and
[validation policy](../development/testing.md) retain their subjects.
The adopted Method gitlink is `703051af50189a70399d82c82ca0f2b17c35f998`.

The focused context is resolved for offline preparation. Credential provenance,
authenticated Sonar producer evidence, and effective writer exclusion remain
partially resolved for deployment. Human functional, structural and governance
decisions keep their existing owners. ADR-0012 has separate Human structural
acceptance; this design grants no standing operation or provisioning authority.

## Verified current deployment

The public GitHub read-back on 2026-11-17 establishes the following.

- Protected `main` is `03c18061a221f508f1f9826a5b9ad19655ecc568`.
  Ruleset `21839336` is active, updated `2026-11-05T16:23:27.687Z`,
  with strict required checks `Quality checks` from App `15368`,
  `SonarCloud Code Analysis` from App `12526`, and
  `Architecture Web / Work Merge Gate` from App `5625775`.
- Tag creation rule `27472739` and immutability rule `27472760` remain
  active at the revisions recorded in [the administrator settings observation](https://github.com/Oxelio/architecture-web/issues/140#issuecomment-6953601088).
  The public REST response omits bypass actors. Preserve the separate
  administrator observation for those fields.
- Controller installation `182503016` passed the [read-only identity job](https://github.com/Oxelio/architecture-web/actions/runs/44120372995).
  This verifies repository scope for that run. It does not verify its full
  installed permissions or writer isolation today.
- PR #146 at `51ff29f090612add9c46972b5580d322e7401b54` passed
  [full CI](https://github.com/Oxelio/architecture-web/actions/runs/44128410055)
  and Sonar. Its probe remains draft and unmerged.
- The ordinary Git transport can publish an authoring branch. A creation
  attempt at `delivery-control/disabled-probe-agent-140-20261117` was
  rejected with `GH013` and the creations-restricted reason. The exact tag
  remained absent. This proves that particular denial.
- A fresh administrator-installation read encountered GitHub reauthentication.
  The earlier settings observations below remain dated evidence requiring
  refresh before cutover. No credential value was read.

Authenticated administrative REST read-back also confirms an empty bypass list on 21839336 and 27472760, and only Integration 5781545 / Always on 27472739. This read used an agent-accessible owner credential, so it establishes configuration observation while also confirming an exclusion blocker.

Repository variables for standing execution/requests, supervised boundary and coordinated Status are unset. Evaluated Gate and completion are enabled. All four protected delivery environments restrict deployment to the main branch. The controller environment contains only its App-key secret, its isolated Project Status writer and gate-issuer composition are not fully provisioned there. Environment secret names were inspected without reading their values.

Standing integration stays inactive. The protected manual integration path
remains effective. The original strict delegation-through-squash deadline is
historical rationale in the integration design. The accepted final-release
admission amendment continues to govern reservations and prospective revocation.

## Writer and permission inventory

An observed permission is distinguished from the exact credential used by a
particular connector invocation. Completion of this inventory for activation
requires effective access evidence for every credential and workflow.

| Path and principal                                                 | Observed grant and repository reach                                                                                                                                                                                                                                                                                                                                       | Candidate-invalidating facts                                                                                                  | Replacement and proof obligation                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent Git via Git Credential Manager                               | Helper `manager`, authenticated API identifies user Oxelio / 83680141 with OAuth scopes `gist, repo, workflow` and repository `admin, maintain, push, triage, pull`. Token value was kept out of output. Issuing client, expiry, other repositories and alternate SSH/askpass paths remain unverified. A classic broad scope has no demonstrated repository-only removal. | Source head, deletion/recreation, force push, candidate-controlled workflows, competing merge through an overprivileged token | Agent retains local Git and read/fetch. An authenticated submission binds commit, parent, source tree and Work to an immutable request. Protected author publishes allowed files with expected-old-ref compare-and-swap. Prove raw Git denial after cutover and audit all usable credential sources.                     |
| ChatGPT Codex Connector installation `154356750`                   | Previous settings show All repositories, write Actions/code/Issues/PRs/workflows and read checks/statuses/metadata. PR author attribution `Oxelio` does not identify its underlying grant.                                                                                                                                                                                | Issue/PR edits, base/head, review records, workflow/rerun writes, candidate publication                                       | Repository-only exclusion requires a selected-repository allowlist preserving every other repository and its intended future access. Third-party App permission categories cannot be reduced by this installation UI. Preserve development through the replacement before removal.                                       |
| GitHub Projects MCP                                                | Existing `projects_write` capability and successful Project #3 writes, current reads available. OAuth client, scopes and complete reach remain unverified.                                                                                                                                                                                                                | Status, classification, membership, ordering where relevant                                                                   | A separately scoped read identity and isolated existing trusted write token. Establish whether the grant can be restricted for this Project without affecting other operations. Refuse a broader revocation without authority.                                                                                           |
| Owner browser and owner-issued credentials                         | Previous Project access lists Oxelio Admin and no other direct member. Repository lists no invited collaborators. Browser session is agent-reachable.                                                                                                                                                                                                                     | All owner-writable facts and protection/configuration                                                                         | Keep the ultimate emergency session inaccessible to agents. An agent-controllable owner browser/token cannot use the accepted emergency exception. Restrict its availability in the ordinary execution environment and prove exclusion.                                                                                  |
| Issues, Tasks, dependencies, labels and evidence                   | Connector and owner identities above, plus workflow credentials                                                                                                                                                                                                                                                                                                           | Open/close/reopen, links, blocking dependencies, labels/classification and creation/edit/deletion of review/decision comments | Typed operations with exact object/revision, accountable Role and authority provenance. Build the affected closure from canonical owners, including reverse/shared dependencies. An arbitrary comment or caller-supplied closure cannot authorize a write.                                                               |
| Native Project workflows                                           | Dated settings show auto-add sub-issues, auto-add open Issues, archive closed Issues after two weeks, close Issue when Status Done. Lifecycle-on-add/close/merge rules were off.                                                                                                                                                                                          | Membership and Issue disposition, including shared dependencies                                                               | Mediate the triggering write and any asynchronous consequence. A queued native workflow may outlive cancellation. Demonstrate terminal processing or replace the relevant native action with a protected equivalent. Do not disable unrelated workflows speculatively.                                                   |
| Candidate branches, PR head/base and authoring APIs                | Code/PR writers above and GitHub REST/GraphQL APIs                                                                                                                                                                                                                                                                                                                        | Source edits and competing direct or native merge, changed target                                                             | Ordinary author has no remote Contents/PR credential. Controller validates the exact branch and expected head. Every PR pointing at that head and the complete affected Work closure enter invalidation. Source branch rules alone do not restrict PR metadata or Issue APIs.                                            |
| Evaluated manual Gate publisher                                    | Main-only job, App `5625775`, separate check token, shared `delivery-work-controller-protected` queue and durable journal guard                                                                                                                                                                                                                                           | Competing success check or native merge authority                                                                             | Preserve it. Recheck the journal inside the queue. An unreadable/active reservation denies a competing publication.                                                                                                                                                                                                      |
| Work completion workflow                                           | Main-only protected completion environment, Project writer and `GITHUB_TOKEN Issues:write`, shared protected queue                                                                                                                                                                                                                                                        | Status Done, Issue close, dependent Work eligibility                                                                          | Existing completion guard must cover the reserved Work and shared dependencies. Test positive unaffected completion and affected deferral, including native auto-close.                                                                                                                                                  |
| Task claim publisher                                               | Main-only validation inside workflow, independent per-Work queue, `ARCHITECTURE_WEB_PROJECTS_TOKEN` and repository reader                                                                                                                                                                                                                                                 | Claim records and facts used by execution/gate checks                                                                         | Audit the token's actual permissions and where claim records live. Join mediated admission for any validity-affecting mutation. Per-Work queue alone does not serialize with final release.                                                                                                                              |
| Repository CI and PR-triggered workflows                           | Candidate revision controls same-repository PR workflow content. Existing validation restores type/coverage artifacts and uses repository `SONAR_TOKEN` in its scan job. Ordinary jobs use read permissions.                                                                                                                                                              | Analysis forgery, credential use or altered workflow granting itself write permissions                                        | Keep privileged code on trusted main, protect its sources from ordinary authoring, use no write/analysis credential in candidate execution. A default read permission is insufficient proof if candidate YAML can request more. Trace transitive scripts, local actions, archive extraction and credential availability. |
| Release publisher                                                  | Trusted main, separate release concurrency, `GITHUB_TOKEN Contents:write`                                                                                                                                                                                                                                                                                                 | Repository-wide permission includes heads beyond intended release tags                                                        | Validate the exact trusted workflow and source digest, confine intended tag/release operations, verify token cannot be reached by candidate code. Its broad token scope is an explicit trust boundary even if the code intends only release writes.                                                                      |
| SonarQubeCloud installation `168653618`, App `12526`               | Earlier installation settings show All repositories. Fresh public check data shows checks/statuses/PR write, Contents/metadata read, security-events write and additional account/organization reads.                                                                                                                                                                     | PR metadata, check outcomes and review decoration outside the controller                                                      | First choice is a provider-supported restriction preserving issuer `12526`. No such per-installation permission reduction has been demonstrated. The alternative below needs separate cutover authority.                                                                                                                 |
| Gate and controller Apps, Project tokens and configuration writers | Controller and gate installations are distinct. Public configuration establishes expected IDs rather than complete effective grants.                                                                                                                                                                                                                                      | Journal, final check, arms, Status, delegation and protection changes                                                         | Verify exact installations, token permissions, repository selection, protected environments and no cross-credential substitution. Main-only environment selection does not by itself prove only intended workflows can consume a secret.                                                                                 |

The existing user-owned Project writer token can carry account-wide Projects
scope. A repository-scoped App does not automatically replace it. Proving a
Project read/write split and a usable, restricted submission channel remains
mandatory. Do not request redundant OAuth test accounts or unrelated Projects.

Exclusion covers all ordinary agent/automation credentials that can reach the
governed repository or Project, even when used from another workspace. An
Architecture-only tool profile cannot neutralize a broad owner token still
available to an agent elsewhere. An enforced runtime boundary must remove host
credential/browser/tool access, not merely select a container for some commands.
The current desktop provides no established proof of that isolation. Scope any
necessary replacement of broad grants and its other/future-repository impact
as a distinct cutover decision. Preserve the full accepted guarantee; do not
substitute an agreement to use the intake for technical exclusion.

### Complete workflow scan

All twelve deployed workflow files were inspected. The earlier
`delivery-work-merge-gate.yml` can publish a check using the Actions token with
`Checks:write`, outside the protected controller group. Its App 15368 identity
cannot satisfy the dedicated Work Merge Gate issuer 5625775. Its check-writing
privilege still belongs in the credential inventory and cannot be ignored when
proving other Actions-issued required checks. Keep arbitrary dispatch/rerun and
candidate-controlled workflow editing outside ordinary execution.

The coordinator dry-run and observation workflows read inventory. The dry-run
can receive `ARCHITECTURE_WEB_PROJECTS_TOKEN` during main dispatch and
installs dependencies without `--ignore-scripts`. The task-claim and earlier
Gate workflows also have such installs. Audit transitive install scripts and
secret exposure before treating any token as isolated. Keep a token's actual
granted permission separate from the code's intended read-only usage.

Administrative metadata read-back lists only `ARCHITECTURE_WEB_PROJECTS_TOKEN`
and `SONAR_TOKEN` as repository secrets. The four protected environments
each hold their own existing key or Projects token. The controller environment
holds only `DELIVERY_CONTROLLER_APP_PRIVATE_KEY`. Thus the deployed standing
job cannot currently obtain the gate key and Projects reader under that
environment, and the proposed Status writer secret is absent. Provisioning a
future isolated composition remains separately authorized work. No secret value
was read for this inventory.

## Controlled authoring and intake target

Reuse the existing durable reservation and `executeReservedGitHubInvalidation`.
Extend its concrete journal envelope only when adding a runtime writer. Do not
add a second lock service. Keep one exact command admission and one durable
write-ahead intent for each remote operation, including when no merge is active.
The protected Actions queue serializes cooperating runtime operations. Exclusive
credentials and durable journal admission protect the intervals after jobs exit.

The smallest useful capability set is commit publication to an authoring branch,
PR creation/editing, ordinary Issue/Task/dependency changes, attributable evidence
recording, and Project classification/Status operations. Existing Status and
completion adapters remain their owners. Prepare these as bounded typed
operations, rather than passing raw HTTP, GraphQL, shell, file paths or tokens.

1. Ordinary agents produce a commit bundle or content-addressed source artifact
   and a typed request without a GitHub write credential. The intake principal
   and Role must be independently authenticated through a protected channel.
   An Issue comment requiring the owner connector token would preserve the
   bypass and cannot establish this boundary. The transport's principal and
   credential lifecycle remain an explicit deployment decision.
2. Trusted main validates repository, Work, operation, source precondition,
   requested changes, protected-file policy and the responsible Role's existing
   authority. Human approval records require authenticated human provenance.
   Agent records cannot impersonate those decisions. Every operation has an
   immutable request ID and command digest. Evidence authorship remains
   attributable to the initiating Role/principal even if an App posts it.
3. Reload the reservation and a complete candidate/Work dependency inventory.
   Unknown scope defers. An affecting request goes through existing cancellation
   and journaled invalidation. `cancelled` proof permits a new write admission.
   A confirmed squash routes to recovery/replanning against the integrated state.
   Null auto-merge, an HTTP ACK, timeout, or lease expiry never proves cancellation.
4. A complete nonintersecting operation may proceed after its durable admission.
   Ref writes use expected-old SHA, source/workflow digest restrictions and
   positive read-back. Issue/PR APIs lacking an atomic expected-version condition
   depend on writer exclusion and single-use admission. The implementation must
   not claim a final read prevents an independent writer race.
5. Revocation before admission prevents new writes. After an uncertain API
   handoff keep the exact intent pending and reconcile the canonical object.
   Never repeat POST creation or append-only evidence publication speculatively.
   If the outcome is known unstarted, close the intent with proof. A new request
   after revocation needs fresh authority. Quarantine ambiguous results.
6. Authoring remains available for unrelated Work. An incomplete reverse
   dependency graph or an unknown writer is a deployment blocker, not a reason
   to globally pause unrelated operations. The offline planner in this change
   classifies only a verified, complete snapshot, it grants no mutation authority.

Protect trusted main workflows, governance, ADRs, delivery scripts and transitive
privileged dependencies from ordinary authoring. Changes to those surfaces keep
the current protected manual integration route. Supporting normal product
changes does not require granting ordinary agents remote workflow-edit rights.
Keep candidate builds secret-free and isolate restored archives before use.

### Concrete intake and operation contracts

The proposed deployment is one repository-specific authenticated intake adapter
in a protected runtime outside the ordinary agent process. It exposes only
`submit-authoring-request` and `read-authoring-result`. It holds a narrowly
scoped dispatch credential and an authenticated binding to the workflow principal.
Agents receive neither that credential nor generic GitHub API access.
Reuse an existing independently isolated MCP/runtime if its credential boundary
can be proved. If none exists, a small isolated intake deployment is necessary
and needs explicit provisioning authority. A local wrapper in the same owner
desktop cannot enforce this boundary.

Each submission carries an immutable request ID, repository ID, Work ID, typed
operation, exact canonical before-state, expiring actor/Role authorization, and
a digest of its requested content. Store the exact bytes and authenticate the
producer independently before protected-main dispatch. Persist result lookup
by the same request ID. Transport delivery/retry never authorizes re-execution.
The command admits no arbitrary workflow path, target repository, API path,
shell program or credential selector.

### Proposed deployment and sealed-request flow

[ADR-0012](decisions/0012-protected-authoring-intake.md) records the accepted structural
choice: one private remote MCP intake outside the agent security principal,
dispatch-only GitHub access, and execution in an existing protected-main Actions
boundary. Its [Human acceptance](https://github.com/Oxelio/architecture-web/issues/140#issuecomment-6963322874)
is target-only. No service, App or permission is provisioned by
this preparation. The product API is not the intake host.

The service exposes the two authoring methods above and a fixed read-only
Project #3 context projection. Protected-main execution fetches that projection
through the existing isolated reader and returns a dated result. The intake and
ordinary agent receive no underlying Projects grant. A cached projection cannot
authorize a mutation; the controller rereads its canonical preconditions.
Avoid a new OAuth connection just to repeat a scope test. Remove the ordinary
Projects write capability from the execution profile only after equivalent
reads and authorized writes through the replacement have been demonstrated.

Use this concrete request path for the proposed implementation:

1. Intake authenticates the ordinary caller and accepts a repository/Work-bound
   typed operation, client idempotency key, exact before-state and content digest.
   Derive the request ID from the fixed repository, authenticated subject and
   client key. Lost first replies can therefore be retried with the same key.
   Identical retries return the original request; a digest mismatch is rejected.
   Consult the durable request identity when staging state has been disposed of.
   Human approval remains a separately authenticated canonical record.
2. Seal the immutable payload before dispatch. A commit publication carries a
   Git bundle or equivalent exact objects, expected old head and full path
   inventory. Stage under finite configured byte/lifetime limits with no payload
   logging. Return explicit rejection when a limit is exceeded. A sealed object
   cannot be replaced by an agent upload after dispatch.
3. Intake dispatches only the proposed `delivery-authoring.yml` on `main` with
   request ID and digest. The dispatch credential has Actions-write and Metadata-
   read for this repository, no Contents/PR/Issue/Project/Checks write. No such
   current narrowed credential is verified. Prefer a token minted with explicit
   permissions/repository selection by a fixed protected renewal job using the
   existing controller App, if its actual grant permits that scope. Deliver only
   the short-lived narrowed token to the intake. Keep the App key in its protected
   environment. Verify expiry, deliberate delegation/revocation and renewal;
   expired credentials defer dispatch. A separate dispatch-only App is the
   fallback if safe reuse cannot be demonstrated, not a required test fixture.
   A dispatch response or returned run ID proves no authoring outcome. Duplicate
   jobs for the same request still require the same single-use journal admission.
4. The trusted workflow authenticates the intake subject and fetches sealed
   bytes from a fixed origin using its constrained OIDC job identity. Verify
   repository, digest, request identity, operation schema, current authority and
   canonical owners. Reconstruct forward/reverse dependencies and PR/ref sharing.
   Authenticate current Role permission; a caller-supplied Role string or scope
   closure is not sufficient.
5. Enter the existing protected queue, reread the durable journal and execute
   the current cancel-or-resolve boundary. Persist an authoring intent containing
   the exact command digest, expected state, verified affected scope and journal
   revision before remote handoff. Reader migration must make every existing
   journal consumer defer on an unresolved authoring intent. No old reader may
   interpret the new envelope as an empty journal.
6. Publish only the admitted operation. For Git, validate objects in an isolated
   bare repository with hooks/configuration/helpers disabled, no candidate code
   execution and a fixed remote. Use server-enforced expected-old-ref semantics
   through Git's ref-update protocol; REST `PATCH git/refs` has no expected-old
   parameter and a preceding GET is not a compare-and-swap. For metadata APIs,
   rely on exclusive writer custody, exact before-state and positive read-back.
7. A matching canonical result confirms the operation. Lost responses retain a
   pending intent. Request-ID markers and exact result digests aid read-only
   reconciliation; absence at one read is not proof that a delayed POST cannot
   create an object later. Do not issue another create or release a conflicting
   writer on that basis. Quarantine outcomes lacking positive resolution.
8. Result lookup returns sanitized status and canonical links. Dispose of staging
   bytes after conclusive completion or verified abandonment; after handoff,
   retain minimized intent/digests rather than payloads merely to enable retries.
   Staging expiry never settles an admitted operation. Revocation prevents new
   admission and any known-unstarted handoff. Reconcile an already-started
   operation without authorizing a replacement. Do not extend the merge-specific
   final-release delegation exception to ordinary authoring implicitly.

The service's sealed payload store is transport staging, not another reservation
database. Journal tags continue to own admission and recovery. A service outage
defers remote operations without giving the agent a fallback write credential.
Public repository reads/local Git editing continue. The isolated Project view
must cover the private context needed for Method work.

Private Project projections and sensitive operation results return directly to
the private intake over TLS. Do not upload them to repository artifacts, step
summaries or public logs. The intake authenticates payload reads and result
callbacks using [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc):
validate the signature against the fixed GitHub issuer/key source, exact service
audience, token lifetime, repository ID/owner ID, `ref`, `workflow_ref`, approved
`workflow_sha`, expected protected environment, `run_id` and first `run_attempt`.
For a reusable job, additionally validate `job_workflow_ref` and
`job_workflow_sha`. Verify the actual subject format during controlled Validation
rather than guessing it or changing live OIDC settings here.

Restrict each job exchange to the sealed request ID and its content digest;
bind the first accepted exchange to its exact run and operation. Duplicates can
return the same sanitized result; they cannot replace result bytes or start a
second command. A valid token from another candidate, workflow, environment,
repository or rerun is rejected. Callback delivery reports an observation and
does not settle an uncertain controller intent without canonical proof. No
OIDC callback grants merge, check publication, Project-write or new admission
authority. This avoids a new shared callback signing key and keeps Project
credentials inside the protected reader job.

The public journal also receives no private projection or staged source payload.
For new authoring intents, represent sensitive before-state and results with
digests and necessary opaque object IDs, keeping exact bytes in the private
transport boundary only while needed. Preserve the existing Status protocol's
approved footprint; do not expand it into a copy of arbitrary private Project
fields. Payload disposal and journal replay identity have separate owners and
must not be implemented as one expiry operation.

The exact-old-ref choice follows the documented
[Git push lease with an explicit expected value](https://git-scm.com/docs/git-push#Documentation/git-push.txt---force-with-leaseltrefnamegtltexpectgt).
The current [REST ref-update contract](https://docs.github.com/en/rest/git/refs#update-a-reference)
offers the new SHA and fast-forward/force choice without an expected-old SHA.
Do not authorize a non-fast-forward update merely because the transport can
enforce a lease; the operation still needs its existing scope/authority.

### Runtime preparation sequence and Readiness allocation

The new structural boundary has explicit acceptance in ADR-0012. Provisioning
its host or dispatch App is a later separate operation. Design acceptance does
not authorize any live credential or issuer change.

| Sequence | Execution unit and canonical input                                                         | Required result before advancing                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Structural review of ADR-0012 and this intake contract                                     | Human project acceptance recorded; no deployment                                                                                               |
| 2        | Inactive request validation and bounded authoring journal envelope in the delivery package | Formal Readiness, immutable subject/request binding, all existing journal readers fail closed, migration and crash/replay fixtures             |
| 3        | Inactive fixed Git/PR/Issue/Task/evidence adapters and Project projection                  | Exact before-state, credential-free fixture tests, shared dependency invalidation, positive-only recovery and unrelated-operation preservation |
| 4        | Protected producer/receipt and check-only publisher composition, still disabled            | Source/run/artifact provenance and strict identity verification; fixtures for all six current Sonar criteria and substitution failures         |
| 5        | Separately authorized provisioned shadow Validation                                        | Actual isolated credentials, provider contract, writer denial, cancellation races, native outcomes and rollback evidence                       |
| 6        | Separately authorized cutover, supervised candidate, then standing gate                    | Existing delivery authorities and positive evidence; uninterrupted mandatory CI/Sonar/Work Gate enforcement                                    |

Do not create another Work or premature Sub-issues for this proposed sequence.
Keep #140's operational owner and #146's journal-probe scope. The current
preparation PR owns these proposed artifacts, not live credential migration.
Steps 2–4 require their applicable Readiness and accepted structural inputs;
step 5 evidence does not have to exist to write inactive implementation.

| Operation                    | Required exact precondition and result                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish commit               | Work-owned source branch, expected old head, proposed commit/tree/blob digests, source base, no ordinary protected-file edit, commit parent and full path inventory. Use expected-old ref update and re-read. Stage an immutable bundle as data, never execute it in the privileged intake. |
| Create or edit PR            | Work, exact head/base and existing PR node/revision for edits. Verify all Work-owning PR relationships. Creation needs a single-use request receipt and exact positive PR lookup after response loss.                                                                                       |
| Edit Work or Task/dependency | Object IDs and complete old fields/relations with role-scoped requested changes. Rebuild affected forward/reverse dependencies and required Task closure. Preserve classification and human decision authority.                                                                             |
| Record evidence              | Kind, candidate tuple, role, authenticated issuer and immutable content digest. The controller records provenance without manufacturing review or approval. Edits/removals are new invalidating requests.                                                                                   |
| Project fields               | Exact Project/item/field/option and source revision. Reuse Status admission and completion owners. Classification changes have their own authorized Method result.                                                                                                                          |
| Read result                  | Request ID and authenticated subject. Return sanitized admitted/pending/confirmed/denied outcome and canonical evidence links. No write or recovery-by-replay.                                                                                                                              |

The deployed pending journal envelope is specialized to Project Status. The
original planner/collector unit did not migrate it. The inactive integration
extends the code with a bounded authoring envelope retaining the native candidate
and operation version. No activated writer emits that format. A pending request
blocks overlapping admissions until positive reconciliation. Validate all
reservation/Status readers and runtime composition before activating the format.

### Authoring journal integration contract

The following is the next inactive implementation unit under accepted ADR-0012.
Use the existing immutable `delivery-control/rN` log and compare-and-append
boundary. Add no tag namespace, second lock service or live writer.

The extended envelope has `kind: authoring`, schema 1, the current native
reservation, a native-version marker, existing Status intent, pending authoring
intents and at most one admission/terminal event for that revision. Pending
intents contain only the public projection, their admission revision and proof
digests. The envelope copies unresolved intents on every append. A terminal
event never grants another handoff. Request lookup verifies immutable history;
discarding payload bytes does not erase its replay identity.

Separate the global journal position from the native operation version. Global
revision advances on every append. Within one native reservation, its logical
version advances by exactly one only when its native state changes. Store the
global source revision for that version, verify that immutable source and its
state on read, and preserve the version across independent authoring appends.
The native controller keeps its exact version/state checks, single-use release
admission and existing authority/candidate verification. Its strict increment
checks are not weakened to arbitrary greater-than comparisons.
Consumers use the boundary's global position for journal CAS; a native receipt's
logical version and source tag must not be repackaged as a global position.

An affecting write first uses the existing cancellation/resolution owner.
Confirmed merge requires replan/recovery rather than an old-state mutation.
After the boundary is conclusive, authoring admission requires a fresh authority
check, exact command/before-state, complete owner-derived scope and an exact
create-only append. An observed matching tag after a lost append response does
not establish that a caller may perform the remote operation.

An independent intent can coexist with a native reservation or another
nonintersecting authoring intent. Readers must compare complete affected scope
against the governed Work/PR/base rather than pause all unrelated operations.
Missing scope or an unsupported protocol remains fail-closed. Existing Status
and manual publishers need that scoped integration before activation; migration
guards alone do not meet this requirement.

After uncertain handoff, only canonical result/proof observation can settle an
intent. Replacement workers reconcile without repeating the mutation. A known-
unstarted result needs evidence that the old executor cannot still hand off;
lease expiry, cache absence, staging expiry and a missing API object do not
supply that proof. Preserve current authority checks and separate the native
delegation amendment from ordinary authoring behavior.
A proven server rejection with no applied effect is terminal `not-applied`,
separate from confirmed success and known-unstarted execution. It still consumes
the request identity. A partial or uncertain result is not non-application proof.

Validation covers strict native-version increments across independent global
appends, source-pointer mismatch, concurrent append losers, shared dependency
conflicts, unknown scope, duplicate request IDs, lost ACKs, terminal replay and
all reservation/Status/manual/completion readers. None of these fixtures proves
installed credential exclusion or authorizes live cutover.

## Sonar strategy and evidence

### Retain issuer 12526 when feasible

The [installed App model](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps)
lets the installer select repositories and review requested permission sets.
Token permission narrowing belongs to the App token issuer. Sonar owns that
issuer. No documented installer control removes only PR mutation while leaving
its Checks permission. Turning off summaries or annotations controls features,
not the granted permission. GitHub's PR-update endpoint accepts PR write for
body, base and state. Branch protection does not mediate those operations.
A vendor-supported lower-permission integration would be preferred after an
actual installation-token denial test, obtain confirmation without changing live
access. Current evidence does not establish that route.

### Protected alternative prepared for review

Use a trusted-main Sonar scan producer and an isolated check-only publisher.
The latter receives no Contents, PR, Issue, Project or Administration write.
Keep the native merge App and Work Gate issuer separate. An eventual new Sonar
check identity, its name and installation must be explicitly accepted and
bound in the protected ruleset and all readers before use.

The smallest proposed publisher reuses the existing checks-only App 5625775
in a separate protected job and installation token, with a hard-coded distinct
context such as `Architecture Web / Sonar Quality Gate`. Public metadata from
the accepted #141 Gate check confirms only `Checks:write` and
`Metadata:read`. No additional App is necessary for this prepared option.
GitHub scopes that permission to all check names, so reviewed trusted code must
confine this entry point to its Sonar context. Reusing the issuer gives that App
the technical capability to issue both gate contexts, which belongs in the
explicit issuer-acceptance decision. If stronger issuer independence is required,
a separate checks-only App is the bounded alternative. Both retain a distinct
native merge identity. No current issuer or ruleset is changed here.

The protected producer binds repository, Work, PR, head, base, trusted control
revision, run attempt, scanner/configuration digest and submission time to the
actual CE task ID returned by the scanner. It checks out exact source as data
and supplies trusted scanner arguments. It runs no candidate scripts or local
actions with an analysis or publishing secret. Reject candidate-supplied
`report-task.txt`, arbitrary task IDs and workflow artifacts as authority.
A GitHub workflow run ID alone proves neither Sonar analysis nor its source.

The prepared read-only adapter uses fixed `https://sonarcloud.io` endpoints,
Bearer authentication, redirect rejection, bounded requests and sanitized
failure outcomes. It verifies authentication and reads the exact CE task,
PR inventory, assigned gate, gate definition and analysis-specific result.
It double-reads the task and PR snapshot to detect changed/replaced results.
The protected producer receipt is a required caller-side trust boundary.
Its issuer/run/source authentication is still a runtime integration obligation.
The offline adapter cannot validate that boundary on its own.

The inactive `protected-sonar-submission.ts` adapter now implements the GitHub
side of that boundary. It independently reads the exact trusted-main producer
run and first-attempt producer job, verifies the bound immutable artifact and
SHA-256 archive digest, and accepts exactly one bounded `submission.json` file.
It matches the complete candidate, control revision, scanner configuration and
all six criteria, then rereads the run/artifact identities. The signed artifact
download receives no GitHub bearer. Unknown redirect hosts, incomplete job
inventory, reruns, extra ZIP entries, stale or mismatched receipts defer.
This proves provenance only: a green run/receipt still cannot replace the
authenticated Sonar CE/analysis/Quality Gate verification in the existing reader.
The producer job, actual provider contract and check-only publication composition
remain separate implementation/Validation obligations. No workflow calls this
new reader and the required issuer remains unchanged.

The proposed producer/publisher handoff is an immutable receipt from a trusted-
main producer run, retrieved using an independently authenticated GitHub read
path. Bind the receipt's digest and artifact ID to the durable candidate record.
The publisher must verify repository, exact workflow identity/control revision,
main ref, run ID/attempt, successful producer job and immutable artifact digest,
then the scanner task/configuration and exact candidate tuple. Use fixed workflow
and artifact contracts. A candidate-produced artifact with a matching name, a
caller-supplied run ID or a re-run artifact is not trusted producer evidence.
This uses existing GitHub run/artifact identity rather than introducing a new
signing-key service. The actual artifact and authentication contract remains a
runtime Validation requirement before release of a passing check.

Before native arming, account for outstanding provider work as well as token
custody. Drain or conclusively account for earlier submitted CE tasks that could
replace the selected PR analysis. New submissions and gate-configuration changes
must use their controlled path. A callback detecting a change after check release
cannot retroactively prevent a native merge. Do not silently exempt a Sonar
administrator or an old candidate workflow retaining an analysis credential.

Sonar's live API catalog describes `api/ce/task` as requiring Execute Analysis,
`api/project_pull_requests/list` as requiring Browse or Execute Analysis,
and `api/qualitygates/project_status` as accepting `analysisId`.
`api/project_analyses/search` exposes long-lived branch filtering and no PR
parameter. Do not fabricate a PR-analysis-history query. A protected receipt
plus exact task ID is necessary to bind the analysis to the known scan.
The CE task endpoint requires an Execute Analysis-capable credential even for
GET. Place this collector in the protected producer boundary. Its performed
operations are read-only, but its credential is not proven Browse-only. Keep
that credential out of the check-only publisher and ordinary candidate execution.
The protected producer reads the terminal CE observation with its analysis
credential and binds it to the immutable receipt. The publisher verifies the
receipt and rereads Browse-accessible analysis and gate evidence. The publisher
requires a terminal task observation for the exact submission to complete a
check. An earlier receipt without a terminal task can support authorized
reconciliation, while a pending or unverified result leaves the intent open.
Live credential permissions and the provider's attestation path remain
Validation requirements.

The PR inventory gives the current PR, branch, target, revision and analysis
date. Recheck before check release. A newer different revision or ambiguous
inventory invalidates the receipt.

Public diagnostics on 2026-11-17 show project `Oxelio_architecture-web` assigned
gate `9`, `Sonar way`, with these existing criteria.

| Metric                         | Comparator | Error threshold |
| ------------------------------ | ---------- | --------------- |
| new_security_rating            | GT         | 1               |
| new_reliability_rating         | GT         | 1               |
| new_maintainability_rating     | GT         | 1               |
| new_coverage                   | LT         | 80              |
| new_duplicated_lines_density   | GT         | 3               |
| new_security_hotspots_reviewed | LT         | 100             |

Snapshot the assigned gate and ordered condition tuples in the protected
producer receipt and compare them on read-back. Preserve the existing provider's
small-change/ignored-condition semantics. Missing numeric conditions,
unexpected duplicates or unverified ignored-condition evidence defer the
prepared verifier. Do not convert them to a passing outcome. Runtime evidence
must cover the provider's actual small-change behavior before cutover.
The prepared verifier accepts only complete nonignored successful conditions.

For the alternative, derive a candidate-specific check from the verified task,
analysis ID, Quality Gate result, exact GitHub context and reserved check ID.
Authenticate the check installation, refuse namesakes and previous-check reuse,
and use single-use durable publication admission with positive reconciliation.
Keep provider task/analysis and gate digest in the accepted evidence identity.
A later Sonar analysis or gate change is an invalidating write. Restrict
analysis submission and gate-admin credentials to the appropriate trusted
boundaries, removing the GitHub App alone does not restrict Sonar administrators
or leaked analysis tokens.

## Migration, rollback and cutover decision packet

1. Integrate and validate the separate #146 probe only through its existing
   authority. Its live run and the replacement in this document have distinct
   acceptance evidence.
2. Review this preparation PR. Fixture-test all writers and exact Sonar
   responses. Independently verify a protected producer's real CE response,
   gate assignment, condition handling and PR binding using a reviewed
   credential inside a protected job. Keep every existing required check.
3. Prepare a restricted intake principal, controller-only repository writer,
   Project reader/writer split and isolated Sonar publisher. Record each exact
   credential/App, repository selection and allowed operation. Inventory all
   workflow-originated writes and owner sessions. Obtain the separate
   provisioning and credential-cutover authority.
4. Shadow the prospective Sonar publisher as an additional distinct check.
   Compare against App 12526 for passing, failing, missing, stale, replaced,
   small-change and unavailable analyses. Do not give it the effective required
   name or treat it as integration authority.
5. After explicit issuer/ruleset authorization, require both old and replacement
   checks while both producers are available. Verify expected App IDs, strict
   policy, Work Gate readers and cancellation behavior. Replace the old required
   issuer only after the replacement is effective. Keep an uninterrupted
   mandatory Sonar path. There is no one-step remove-then-add migration.
6. With separately authorized repository-only access changes, replace ordinary
   Git/connector/MCP writes and verify actual denial plus all normal authoring,
   PR, Issue, review and Project operations. Prove every affected operation both
   before and after check release. Broad All-repositories installations require
   an explicit allowlist and future-repository impact decision before editing.
7. Only a separate exact supervised-candidate grant can start native squash.
   Record downstream release/completion, revocation, cancellation and recovery
   evidence. Standing activation is a subsequent distinct decision.

Rollback stops new admissions, resolves or quarantines outstanding operations,
and preserves restricted writers until no stale native merge remains possible.
Keep the existing manual path. Before restoring any old writer or removing a
replacement mandatory check, restore and verify a viable mandatory Sonar path.
A retained old check with a disconnected producer blocks integration and is not
a functional rollback. Re-enable previous connections only after exact authority
and explicit resolution evidence. Preserve journal entries and audit records.

The remaining human-only packet covers the exact principals and scopes in the
inventory, the producer/issuer choice, any new production credentials,
repository selection changes and their impact on other/future repositories,
required-check and reader migration, owner-session exclusion, and eventually
supervised and standing activation. Approval of preparation does not decide
these. No live change is performed by this PR.

## Readiness, implementation sequence and validation

For the **offline preparation unit**, Readiness is **READY WITH RISKS**.
Authority is the bounded preparation decision. The design uses existing
reservation/cancellation semantics and fixed provider reads. It can implement
a pure controlled-write disposition planner and a read-only Sonar evidence
adapter with injected fixture transport. Neither module is wired to a workflow
or a write credential. No production mutation is possible through them.

The [implementation Readiness assessment](https://github.com/Oxelio/architecture-web/issues/140#issuecomment-6974194387)
is **READY WITH RISKS** for the complete authorized inactive implementation,
including runtime adapters and intake/publisher composition. Its accepted design
and contracts are sufficient to write that code. Provisioned identity, provider
integration and writer-denial evidence belong to subsequent Validation; they
are not circular prerequisites for implementing the inactive mechanisms.
The [operational transitions](https://github.com/Oxelio/architecture-web/issues/140#issuecomment-6974221171)
are recorded in the owning Work. Project #3 remains the current Work State owner.

Live writer cutover remains **NOT READY** until the principal/credential boundary,
protected producer bindings, permission/provenance evidence and separate authority
are resolved. An implementation Readiness result does not authorize deployment.
Complete the inactive units, then perform independent review and candidate-bound
validation. Carry the following risks to that review and controlled Validation.

After [structural acceptance](https://github.com/Oxelio/architecture-web/issues/140#issuecomment-6963322874)
and the [next scoped Readiness](https://github.com/Oxelio/architecture-web/issues/140#issuecomment-6963430002),
the request metadata unit adds deterministic subject/client-key identity and
command digests for the initial six fixed operation classes. It checks existing-object
metadata and creates a minimized public intent projection. Neither preparation,
projection nor replay classification grants admission or verifies Role authority.
Raw subject, client key, payload and private Project values are absent from the
projection. Existing journal consumers explicitly reject unsupported kinds,
including a record with otherwise valid legacy reservation fields.

Inactive durable history/admission now uses the existing log. It preserves
pending intents and native operation versions, verifies source pointers and
predecessor continuity, and settles only through a trusted read-only proof
adapter. History read capacity is an explicit resource bound: incomplete history
defers rather than invents absence or a replay horizon.

Runtime scope/authority/proof composition and the remaining owner operations
are following units. The legacy Status pending slot remains exclusive with
authoring intents. Normal scoped Status mutations must migrate through their
typed authoring adapter before activation; this conservative migration guard is
not the final ordinary-write route. Scoped manual/completion reads can proceed
for unaffected Work; unknown targets defer. No hosted intake or workflow calls
authoring admission. The inactive intake implementation now includes:

- `src/intake/authoring-intake.ts`: the official MCP SDK transport, caller-bound
  submission/result tools, private Project reader boundary, bounded HTTP bodies
  and authenticated private job exchanges. Construction never opens a listener;
  both the web handler and Node mounting factory remain disabled by default.
- `src/intake/sealed-authoring-store.ts`: private single-host staging, immutable
  payload/header/dispatch/job/result receipts, atomic create-if-absent, finite
  explicitly configured byte/lifetime limits and payload disposal. Receipt
  retention is separate; staging expiry cannot prove executor quiescence.
- `src/intake/github-job-authentication.ts`: signed GitHub OIDC verification of
  the exact protected main workflow/control revision, repository/owner,
  environment, audience and first run attempt. Reusable jobs are rejected until
  their distinct identity contract is explicitly supported and verified.
- `src/intake/authoring-dispatch.ts`: one fixed main-workflow endpoint using only
  the separately provisioned short-lived dispatch credential. Its capability
  narrowing and renewal still require actual deployment Validation.
- `src/github/controlled-authoring-execution.ts`: durable admission followed by
  at most one remote handoff, current authority/before-state checks and a
  separate read-only recovery path. Runtime canonical scope, authority,
  cancellation and operation-specific proof adapters remain required inputs.
- `src/github/authoring-metadata-operation.ts`: fixed Work/PR title/body PATCH
  adapters with authenticated exact before-state reads and canonical result
  verification. Payloads cannot select an API path, close/merge operation or
  approval verb.
- `src/github/authoring-status-operation.ts`: the existing authenticated Status
  command and canonical writer mapped into scoped authoring admission. Match
  sealed bytes to that exact command and its Project/item/field/before-state;
  preserve the existing transition/evidence owner. No activated Status workflow
  is rerouted by adding this adapter.
- `src/github/git-authoring-operation.ts`: isolated bare-Git bundle inspection,
  exact advertised ref/commit, canonical base/prerequisite verification, complete
  new-commit and final-delta path inventory, sanitized diagnostics and one leased
  push to the fixed repository. Expected absence supports branch creation.
  Non-fast-forward publication additionally requires explicit existing Work/Role
  authorization; the lease supplies no authority. The trusted inventory verifier
  still owns branch scope and protected-file enforcement.
- `src/github/authoring-creation-operation.ts`: PR and native Task creation under
  an existing Work. Task creation supplies GitHub's `parent_issue_id` in the one
  create request and verifies the resulting native parent. PR creation verifies
  absence of an existing owning/source PR and the exact head/base. Positive
  recovery requires one authenticated, exact marked object; absence or multiple
  matches cannot release the intent. This does not invent a provisional owner
  or another registration policy for new top-level Work ideas.
- `src/github/authoring-facts-operation.ts`: native Task dependency changes and
  attributable evidence append, with complete paginated source reads, exact
  old state, one remote operation and canonical read-back. Evidence is issued
  by the verified automation identity and cannot impersonate Human Approval.
- `src/github/authoring-project-field-operation.ts`: the currently activated
  non-Status single-select fields (Work Type, Workflow Depth and Priority), exact
  Project/item/field/option binding and independently held read/write credentials.
  Priority additionally requires its authenticated human authority. Classification
  permission cannot supply that decision. Status continues through its dedicated
  Method owner, and unsupported or ambiguous field mappings are rejected.

The two creation verbs extend the inactive typed protocol without accepting
arbitrary REST/GraphQL input. Installed provider support and identity fields must
be verified during controlled Validation. The corresponding provider contracts
are [issue creation](https://docs.github.com/en/rest/issues/issues#create-an-issue)
and [native dependencies](https://docs.github.com/en/rest/issues/issue-dependencies).

The inactive execution composition now reads Work membership from Project #3,
walks native parents, sub-issues and both dependency directions, and matches
open PRs against the affected Work and source refs. It rechecks the resolved
scope before handoff. Ordinary PR metadata edits preserve the explicit owning
Work. Unavailable or incomplete scope defers the operation.

The job transport binds the sealed bytes to the request and reports only an
exact terminal journal receipt. The intake verifies the signed dispatch actor
and the workflow revision against the protected baseline. A new `main` commit
with identical privileged Git trees and install configuration remains eligible.
The whole lockfile is part of that baseline. A dependency change requires an
updated accepted baseline.

The inactive Sonar producer derives scanner settings from the trusted candidate
and reads the CE task from the scanner's private output. The check completion
adapter combines the GitHub producer receipt, authenticated Sonar provider
read-back and a protected admission for the exact issuer/check/evidence tuple.
It verifies the completed check through the existing check adapter. These
functions still require the protected job's validated credential and authority
composition. Sonar submission, check creation and check completion now use
the shared journal's single-use admission. A pending CE submission intersects
the candidate reservation until the trusted receipt and the authenticated
provider establish a terminal task outcome. Task settlement records completion
of the transport operation. The Quality Gate independently evaluates success
against the existing criteria.

These paths are relative to `packages/tooling/delivery-automation`. No workflow
or installed service calls this composition. The private host must exclude
agents from its volume/configuration and enforce its ACLs; Unix mode bits alone
do not establish that boundary on Windows. Configure and schedule staging
cleanup before deployment. No transport receipt expiry, general repository
retention policy or live service credential is established by these modules.
Valid deployed reservation/Status behavior is preserved;
unsupported or contradictory protocol data is not an empty boundary.

| Boundary                          | Required evidence                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controlled-write planning         | Inactive default, repository scoping, unknown scope, shared/transitive dependency, unrelated write, exact PR/ref match, every nonterminal phase, confirmed cancellation, confirmed squash and command replay                                                              |
| Existing journal and controller   | Competing admissions, durable append conflict, revocation before admission, known-unstarted result, lost handoff/ACK, replacement worker, positive-only recovery, held and released cancellation, no reuse of final admission                                             |
| Sonar reader                      | Credential rejected or absent, no redirect, no arbitrary host, exact project/PR/head/base, pending/failed/missing CE task, gate errors, changed assignment/conditions, wrong analysis, duplicate PR, stale receipt, changed snapshot and sanitized network failures       |
| Sealed intake and private results | Lost first reply, conflicting idempotency key, disposed staging with durable deduplication, duplicate dispatch, token expiry/renewal, wrong OIDC issuer/audience/repository/ref/workflow/environment/run, result replacement and private-data leakage into logs/artifacts |
| Producer and check-only publisher | Actual authenticated provider responses, protected source/run binding, secret-free candidate execution, namesake/substituted check, wrong App/install, changed head/base, single use and uncertain publication reconciliation                                             |
| Live cutover and rollback         | Actual ordinary writer denial across the armed-to-terminal window, allowed independent writes, native automation consequences, mandatory check continuity, supervised squash, source/completion events and restoration                                                    |

Fixture tests establish logic only. Existing GitHub CI and mandatory Sonar
remain candidate-bound validation for the new preparation PR. No unavailable
local Docker result is required for these delivery-tooling-only changes.

## Review disposition for preparation

The inactive modules introduce no deployed service, credential, port exposed to a
bounded context, workflow, journal schema, check name or production switch.
Their existing-package responsibilities do not require an additional ADR.
The protected intake structure has Human project acceptance in ADR-0012.
Provisioning it and changing the effective Sonar issuer
retain their separate operational/governance and cutover boundaries.

Code, architecture and compliance review use the adopted Method's separate
perspectives. A single physical reviewer may change Role with refreshed context.
Review of these modules cannot accept runtime producer provenance, installed
permission exclusion, hosted intake deployment, or production activation.

Public provider observations are diagnostic evidence. The prepared adapter
requires authenticated responses and a trusted producer record. The actual
provider contracts and supported authentication are described in the
[Sonar Web API](https://docs.sonarsource.com/sonarqube-cloud/appendices/web-api).
The current endpoint descriptions were read from Sonar's live API catalog,
and gate assignment/definition were read without changing any policy.
