# ADR-0012 — Isolate ordinary authoring behind protected intake

**Status:** Proposed
**Content status:** Proposed Target
**Document type:** Architecture Decision Record
**Domain:** Delivery automation / credential boundaries

## Context

[Task #140](https://github.com/Oxelio/architecture-web/issues/140) prepares the
writer boundary required by the accepted Work #115 controller target. Its
[human decision](https://github.com/Oxelio/architecture-web/issues/140#issuecomment-6960488409)
authorizes preparation, not provisioning, permission changes or activation.
The [Technical Design](../controlled-authoring-and-sonar-evidence.md) owns the
dated inventory, operation contracts and validation sequence. The
[delivery profile](../../project/delivery-pipeline.md) retains Method Role,
approval, reservation, revocation and integration authority.

Ordinary agents can currently reach owner Git credentials, a writable GitHub
connector, Projects MCP and an owner browser. Sonar App 12526 and several
workflows are additional writers. A final controller read cannot exclude these
writers between release of a passing check and native squash. A wrapper running
as the same desktop user cannot isolate an owner credential from that user.

## Problem

Removing direct writes without a usable replacement would prevent normal
autonomous development. Leaving the credentials available would preserve the
freshness race. Remote credential custody and the route for publishing locally
prepared commits therefore require an explicit structural choice.

## Decision drivers / constraints

- Restrict all proposed mutation targets to repository 1336937640 and Project #3.
- Preserve authorized commit, PR, Issue, Task, evidence and Project operations.
- Reuse the existing durable reservation and cancellation/resolution owners.
- Keep all existing human decisions and the protected manual path.
- Keep native merge, check publication and Project credentials separate.
- Provide no general GitHub proxy, agent-selected workflow, shell or API route.
- Preserve mandatory authenticated exact-candidate Sonar evidence and criteria.
- Keep standing integration inactive during preparation and deployment tests.

## Options considered

### Option A — Local wrapper with the current credentials

**Advantages:** no service deployment; existing clients continue to work.

**Disadvantages:** agents can call Git, APIs or the owner browser directly.
Method instructions, a wrapper and branch protection do not exclude Issue,
Project or PR metadata writes. This cannot establish the required boundary.

### Option B — Isolated intake and existing trusted-main execution

**Advantages:** agents retain a small authoring capability while GitHub write
credentials remain outside their execution environment. Existing protected
Actions execution, reservation and recovery remain the mutation authority.

**Disadvantages:** one isolated intake deployment and a dispatch-only credential
are necessary. Access changes and actual denial tests are still required. An
intake outage defers remote authoring; local editing and public reads remain
available. Sealed source payloads need bounded staging and disposal controls.

### Option C — Put all writes and merge authority in the intake service

**Advantages:** fewer transport hops.

**Disadvantages:** moves native merge, Project and check secrets out of their
existing protected environments and duplicates the controller's durable
execution/recovery boundary. A submission-facing process gains excessive power.

## Proposed decision

**Recommended option:** B. This is a proposal requiring explicit Human project
acceptance under the [Project Method Profile](../../project/project-method-profile.md#4-human-authority-policy).

Deploy one private server-side MCP intake outside the ordinary agent/desktop
security principal. Keep it outside the product API and bounded contexts.
Its fixed repository adapter exposes authoring submission, result lookup and
a read-only projection of the required Project #3 context. It authenticates
the caller; it does not accept caller assertions of Human approval.
The Project projection is fetched by protected-main execution using its isolated
reader and returned as a dated result. The intake holds no Project token; a
cached projection never replaces a fresh canonical mutation precondition.
Return private results directly to the private intake, not repository artifacts
or job logs. Authenticate job payload reads and result callbacks with GitHub
Actions OIDC restricted to the exact repository, trusted workflow/revision,
main ref, protected environment and first run attempt. Request/result binding
is still required; OIDC identity alone authorizes no GitHub mutation.

The intake holds only a repository-scoped Actions-write dispatch credential.
It dispatches a fixed trusted-main authoring workflow with a sealed request ID
and digest. It holds no native-merge, check, Project-write or repository-content
credential. Agents receive a capability to call the intake, never its GitHub
credential. Do not expose generic workflow dispatch through that capability.
The [GitHub dispatch contract](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
supports installation tokens with Actions-write. This does not grant a narrower
per-workflow GitHub permission.

Prefer reuse of the existing controller App through an explicitly narrowed,
short-lived Actions-write / Metadata-read installation token, issued inside the
protected-main boundary. GitHub supports limiting an installation token's
[repositories and permissions](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app).
The App key stays in its existing environment; the intake cannot mint broader
tokens. A fixed protected renewal job can deliver a replacement through the
authenticated private channel. Do not let token-action cleanup immediately
revoke a credential deliberately delegated for that lifetime. An expired token
defers dispatch until renewal; scheduling is not an availability guarantee.

The existing App's Actions-write grant has not been verified. Reuse therefore
requires effective-grant and narrowed-token evidence and any separately
authorized grant change. If safe reuse is unavailable, the bounded alternative
is a private dispatch-only App installed only on this repository. No new GitHub
user is needed. Never put a native controller or gate App key in the intake.
Credential transfer, permission changes and any installation remain separately
authorized operations; this ADR accepts none of those live actions.

The service stores immutable, content-addressed payloads only for staging.
A required client idempotency key and authenticated subject determine the
repository-bound request ID. Submission retry with the same key and bytes
returns the same request even if the first reply was lost; changed bytes under
that key are rejected. Durable request identity survives payload disposal through
the controller's journal rather than an expiring service cache. The existing
protected journal owns admission and outcomes. The service's storage is neither
a second lock nor evidence that a remote mutation occurred. Controller payload
reads use the constrained job identity and a fixed origin. Its result callback
can report only that request's outcome, never create a new authoring command.
Staging limits and expiry are explicit; expiry cannot prove that an already-
started operation stopped.

Trusted-main authoring execution authenticates the request, reconstructs its
complete affected scope, checks existing Role/authority decisions, and admits
the exact operation against the durable journal. It cancels or conclusively
resolves an affected native merge before writing. Candidate source is data;
candidate scripts, hooks, local actions and install scripts receive no write
credential. The future authoring workflow and intake deployment are protected
control-plane sources, integrated through the existing appropriate gates.

Keep current native-merge, check-only and Project writer credentials in their
separate protected boundaries. Verify each installation's actual grant before
using it for an authoring operation. An authoring token's technical ability to
write a ref is not new authority to merge or alter protected control-plane code.

The existing ordinary write paths must become technically unavailable to every
ordinary agent or automation identity that can reach this repository or Project,
including agents working on other repositories. Isolating this chat alone while
another agent retains an owner-wide token would leave the same bypass.

Use an enforced execution/tool boundary without owner GCM, owner browser,
writable connectors or an escape to the host principal. An agent that retains
host tools cannot become isolated merely by running selected commands inside
a container. The current desktop's ability to enforce such a profile is not
established. Keep the ultimate owner session in a separate human-only path.
Preserve reads through public/read-only access and the private Project projection.

No additional OAuth account or connection is needed solely to test known scopes.
Broad ordinary credentials may need replacement with repository-selected grants
or inaccessible credential custody across other agent contexts. That operational
impact is not authorized by repository-only preparation. Any All-repositories
installation change must preserve unrelated access and explicitly address
future-repository behavior before approval or execution. If exclusion cannot be
proved, retain inactive operation; this decision does not reduce the guarantee
to agents that voluntarily use the intake.

The accepted emergency administrator exception remains unchanged. This ADR
does not extend it to an agent-accessible owner token or silently add a provider
administrator exception. Sonar submission/configuration writers and outstanding
provider work remain part of the cutover proof obligations.

## Consequences

### Positive

Ordinary development uses an authenticated, attributable path without retaining
remote bypass credentials. Cancellation and uncertain-result recovery have one
durable owner. Main-only execution can reuse the existing controller rather
than introducing a general lock or orchestration service.

### Negative / trade-offs

The intake becomes a trusted availability and authentication boundary. Its
implementation, deployment identity, payload isolation and dispatch-only grant
must be validated. GitHub does not scope Actions-write to one workflow; the
fixed route is enforced by reviewed intake code and inaccessible credentials,
not by a claim that the token itself has that finer permission.

Privacy-sensitive payloads must not be logged or retained indefinitely. Remove
staged bytes after conclusive completion or verified abandonment; after handoff,
recovery should use minimized digests and canonical read-back rather than retain
source copies merely to permit speculative retries. An uncertain outcome stays
quarantined even if its staging bytes have been disposed of. Deployment must
establish finite staging limits and the applicable handling of exceptional
payloads; this proposal creates no general evidence-retention policy.

Removing the Sonar GitHub App is not part of this decision. The alternative
Sonar publisher, check identity and uninterrupted ruleset migration retain their
separate acceptance and Validation requirements.

## Target and synchronization

**Approved target affected:** no target changes until this proposal is accepted.
It refines the implementation boundary proposed for the accepted controller
freshness objective; it grants no new decision authority.

**Current-state owners to synchronize when effective:** the integration design,
delivery deployment documentation and installed permission inventory. The
product architecture and Functional Specifications have no amendment here.

**Implementation / migration implications:** first accept the structural target,
then assess Readiness for the inactive request/journal/adapters execution unit.
Real credentials, provider and writer-denial tests occur during separately
authorized controlled Validation. Only a later authorized cutover can replace
ordinary writers. Keep #140 Preparing, both current drafts, mandatory checks
and standing-disabled operation until their respective gates permit otherwise.
