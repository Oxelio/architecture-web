# Dynamic security feature and policy configuration

> **Identifier:** SF-SECURITY-CONFIG-001
>
> **Lifecycle:** Approved
>
> **Content status:** Canonical
>
> **Document type:** Functional Specification
>
> **Domain:** IAM / Security Configuration
>
> **Functional dependencies:**
> [SF-PASSWORD-001](SF-PASSWORD-001.md),
> [SF-MFA-001](SF-MFA-001.md),
> [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md)

## Context

Functional security policies are currently defined through environment
variables and built when the API starts. This includes the password policy and
its checks. A change therefore requires a deployment operation and a restart.

This does not let an authorized administrator enable or disable a feature
without redeploying, adapt a policy to the organization, see what is actually
enforced, understand dependencies, or review change history.

## Functional objective

Provide an administration configuration center for dynamically controlling
optional features and security policies. A published change must become
effective without restarting the application. Only valid, consistent
configurations attributable to an administrator may be applied.

Every new business feature must explicitly declare whether it can be enabled or
disabled and which settings it exposes. A non-disableable feature must justify
the exception through an integrity, security, or operational requirement.

## Terminology

- **Feature**: an available or unavailable business capability.
- **Policy**: rules governing a feature.
- **Published configuration**: the latest revision requested and validated.
- **Effective configuration**: the revision actually used by the application.
- **Initial value**: a deployment value used at system initialization.
- **Non-disableable baseline**: safeguards protecting configuration and
  application integrity.

## Configurable scope

The first version must represent at least:

| Area           | Expected options                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Accounts       | public sign-up, email verification, email change                                                                  |
| Authentication | MFA availability and role-based requirement once implemented                                                      |
| Passwords      | standard and privileged levels, lengths, strength, and optional checks from [SF-PASSWORD-001](SF-PASSWORD-001.md) |
| Sessions       | user session management and lifetime once configurable                                                            |
| Recovery       | account recovery once implemented                                                                                 |
| Account data   | export and deletion once implemented                                                                              |
| Audit          | audit access and retention once implemented                                                                       |

An option may be visible before its feature is installed. It is then marked
**unavailable** and cannot be enabled. The UI must never suggest that an
unsupported feature is effective.

The catalog is extensible: a new feature should not require a dedicated screen
when a generic supported field type is sufficient.

## Boundary with operational configuration

The administration center must not expose or modify database, Redis, or SMTP
credentials; encryption and signing secrets; provider tokens; infrastructure
addresses; trusted proxy, secure cookie, or CORS settings; cryptographic
algorithms requiring controlled migration; or settings required for startup and
recovery.

These remain deployment-controlled. Administration may display non-sensitive
status, but never secret values or an editing form.

## Non-disableable security baseline

The optional-feature principle does not apply to safeguards needed to administer
it. These are always active:

- administrative authentication and authorization;
- server-side validation before publication;
- configuration change history;
- concurrent update protection;
- secret exclusion from responses and logs;
- an operational recovery path;
- invariants preventing permanent loss of administrative access.

Security audit consultation may be optional. Minimum configuration history
remains mandatory and cannot be disabled from the application.

## Catalog and functional model

Each option declares a stable key, label, description, category, constrained
type, secure initial value, published and effective values, availability,
impact, dependencies, incompatibilities, enable/disable behavior, and optional
introduction version.

Supported types include booleans, bounded integers and durations, a single
choice from a closed list, and sets of choices.

An unknown or removed key is never interpreted silently. It is reported as
obsolete or incompatible without preventing the latest known valid revision
from loading.

## Initial values and source of truth

Existing functional environment variables initialize the first revision during
migration. Persisted configuration then becomes the functional source of truth.
Environment variables must not silently overwrite administered values on
restart. Any operational override is explicit, visible, and documented.

At first initialization, existing values are validated, an initial revision is
created with a `deployment initialization` origin, and secret or purely
technical values are excluded.

## Administrative consultation

An authorized administrator can view published and effective configuration,
distinguish customized and initial values, search and filter by area, state, and
impact, understand effects and dependencies, identify unavailable features,
review the author, date, and reason of revisions, and compare revisions.

Settings use business language rather than environment variable names. Public
values required by user journeys, such as password requirements, may be exposed
through a dedicated contract. Internal options and history are never public.

## Editing and publication

The administrator edits the latest revision. The system validates types, bounds,
dependencies, and invariants, then displays a diff and expected effects. The
administrator supplies a reason and performs step-up confirmation for critical
changes. All changes are published atomically, effective configuration is
refreshed, and application status is displayed.

Step-up confirmation requires at least recent authentication and may require the
password and MFA when available. A concurrent publication cannot be overwritten;
the administrator must reconcile the conflict.

## Dependency validation

Options may declare mandatory dependencies, incompatibilities, linked bounds,
suggested consequences, and activation order. No destructive cascade is applied
implicitly.

For example, role-based MFA cannot be required while MFA is unavailable; MFA
cannot be disabled while such a policy requires it; compromised-password checks
need a compatible checker; password minimum length cannot exceed maximum length;
and a feature needs its required migration and adapter.

## Change effects

Every option documents whether its effect is immediate for new operations,
immediate with reevaluation, progressive at the next user interaction, deferred
until a stated condition, or exceptionally requires a clearly justified
restart.

Password policy changes initially apply to newly created or replaced passwords
without silently invalidating stored passwords. Existing-user enforcement needs
a dedicated journey, deadline, and communication.

Disabling a feature blocks new operations, retains required data, defines
in-progress behavior, and never deletes data merely because it was disabled.

## Propagation and consistency

All active instances must converge on the same revision after publication. The
result reports whether it is effective everywhere, propagating, partially
applied, or refused and not applied.

An instance never builds a hybrid policy from two revisions. Each use-case execution captures one revision and shares it with its nested calls. A later MFA challenge confirmation is a new execution and captures the then-current revision; in-flight executions finish with their captured rules. This execution boundary was explicitly selected by the project maintainer for the IAM correction. The initial normal
operation target is convergence within five seconds; immediate-risk options may
require stricter behavior.

## Errors, fallback, and restoration

Invalid configuration is never published. If a revision cannot become
effective, the application keeps the latest known valid revision, reports the
discrepancy, and never silently falls back to environment variables.

Restoring an older revision creates a new revision and preserves history. It is
validated against the current application version.

A documented operational procedure must restore safe configuration when the UI
is inaccessible, and its use is recorded when storage becomes available.

## Authorization

The existing `admin` role may view and modify configuration in the first
version. The model still distinguishes viewing, proposing, publishing,
restoring, and reading history for future separation of duties.

An administrator cannot delete history or alter revision authorship. The system
refuses configuration that removes the final valid administrative access path. The same protection applies to account suspension and role removal, as explicitly selected by the project maintainer for the IAM correction. An access path requires an active administrator, a non-revoked password authenticator, a usable allowed identity, and enrolled MFA when required; no enrollment grace or recovery exception is implied.

## Traceability and notifications

Every publication or restoration attempt records revision, actor, date, reason,
changed keys, non-sensitive before/after values, validation and application
result, and `administration`, `initialization`, `restoration`, or `operations`
origin.

Critical successful or refused changes produce an event following
[SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md) when available. Relevant
administrators are notified after a material protection reduction.

Sensitive values never appear in diffs, notifications, or events. The first
version does not configure secrets.

## User experience

**Administration > Configuration** is a dedicated page. It does not expose JSON,
environment-variable names, or the persistence format as its primary
interface.

Settings are grouped by domain and rendered from a descriptive catalog:

- a switch for enablement;
- radio buttons, choice cards, or a closed select for a level;
- a number field, optionally paired with a slider, for a bounded value;
- a multi-select for affected roles or capabilities.

A slider never replaces the number field when an exact value matters or the
range is wide. Every control shows its unit, bounds, recommended value, effect,
and unavailability reason. An option without an executable consumer is
read-only and marked **not effective**; it cannot be published.

The page shows effective state, understandable help and consequences, preserves
an unpublished draft, restores one field or the whole form to published values,
validates during editing with field-specific errors, warns about
weaker-than-recommended values, distinguishes warnings from blocking errors,
shows dependencies before confirmation, and presents before/after values,
affected features, and effect mode in a preview step.

A non-empty reason is required before publication. The journey requests
explicit step-up confirmation for critical reductions, distinguishes version
conflicts from validation and application failures, prevents duplicate
submission, supports keyboard and assistive technologies, and shows the last
refresh time and viewed revision.

A `recommended` indicator guides choices without blocking deployments with
different constraints.

History and the audit log are reachable from the page but do not replace the
editor. History can open revision details, identify author and reason, compare
values, and request restoration.

Technical ownership and currently observed gaps are documented in
[Security configuration redesign](../architecture/security-configuration-redesign.md).

## API and disabled features

Administrative contracts expose the catalog, effective revision, history,
publication, and restoration.

When a feature is disabled, the client hides or disables its entry point, the
server also refuses the operation, the API returns a stable business code, and
the response leaks no otherwise inaccessible resource. Client-side hiding alone
is never access control.

## Migration

Migration inventories functional environment variables, separates them from
secrets and operations settings, creates and verifies the initial revision,
enables dynamic reads, then deprecates historical functional variables and
documents their future removal.

During transition, exactly one source is authoritative for each option. Competing
sources are never merged using an implicit precedence order.

## Test scenarios

Tests cover at least:

1. initialization from existing functional values;
2. refusal for non-administrators;
3. a valid change without restart;
4. invalid type, bound, or combination;
5. dependencies and unavailable capabilities;
6. step-up confirmation for critical reduction;
7. atomic multi-option publication;
8. concurrent administrator conflict;
9. multi-instance convergence;
10. retention of the latest valid revision after failure;
11. restoration creating a new revision;
12. inability to disable the baseline;
13. absence of secrets from contracts, diffs, and traces;
14. server-side refusal of a disabled feature;
15. in-progress operation behavior;
16. password policy applying only to new operations;
17. complete immutable history;
18. recovery after loss of administration access;
19. unknown or obsolete options;
20. administrative journey accessibility.

## Acceptance criteria

The feature is complete when an authorized administrator publishes
configuration without restart; optional features declare state, dependencies,
and disable behavior; configuration is validated, versioned, atomic, and
recorded; all instances use a consistent revision within the stated delay;
failure retains the latest valid revision; secrets and operational settings stay
outside the center; baseline controls cannot be disabled; the server refuses
disabled features; the existing password policy is controllable after migration;
and critical changes are confirmed, traceable, and restorable.

## Out of scope

The first version excludes infrastructure secret management; per-user, group,
or organization configuration; percentage rollouts; future scheduling;
multi-person approval; runtime cryptographic algorithm changes; and automatic
data deletion when disabling a feature.
