# Security configuration redesign

> **Lifecycle:** Implementation
>
> **Content status:** Mixed
>
> **Document type:** Technical Design / Remediation Plan
>
> **Domain:** IAM / Security Configuration

## Position in the pipeline

This design predates the formal delivery pipeline and is being retained as the
technical owner for the ongoing security-configuration remediation. Its
functional source is
[SF-SECURITY-CONFIG-001](../specifications/SF-SECURITY-CONFIG-001.md), now
classified as `Approved`.

The `Implementation` lifecycle is intentionally not `Done`: remaining target
work and missing evidence must be reviewed and validated before the subject can
complete the current pipeline. Future redesign work should use the standard
[Technical Design template](../project/templates/technical-design.md).

## Status and scope

This document is an architecture assessment and remediation plan. Expected
functional behaviour remains defined by
[SF-SECURITY-CONFIG-001](../specifications/SF-SECURITY-CONFIG-001.md). Facts,
target rules, and future work are separated so recommendations are not
presented as implemented behaviour.

The scope includes the security configuration centre, its consumers, and
configurable rules currently held by domain objects or technical components.

The “observed facts” below are historical baseline evidence, not the current implementation. Current ownership, atomic publication and remaining limitations are described in [IAM security](iam-security.md). Current progress is:

| Workstream                       | Current state                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| typed form and catalog           | implemented; email verification consumed by registration and identity replacement          |
| single password policy           | implemented through operation-scoped projections and shared validation, including recovery |
| injected session duration        | implemented by shared application session issuance                                         |
| single validation schema         | owned by the IAM domain configuration parser                                               |
| capabilities inside use cases    | implemented for sign-up, email change, and personal sessions                               |
| public capability contract       | implemented at `GET /v1/iam/capabilities`                                                  |
| strengthened publication         | reason, preview, confirmation, and restoration implemented                                 |
| step-up reauthentication         | implemented for critical publication and restoration                                       |
| multi-instance propagation state | pending                                                                                    |

## Assessment

### 1. The interface exposes the storage format

**Observed fact.** `AdminSecurityCenter` renders the whole policy in a JSON
`textarea`. Administrators must know internal keys, types, units, and
dependencies. Syntax and value errors produce a generic message rather than a
field-specific explanation.

The API catalog only returns `key`, `type`, `impact`, and `available`. It lacks
labels, descriptions, categories, units, bounds, choices, recommended values,
dependencies, and unavailability reasons. A client therefore cannot build an
understandable and accessible form from it.

**Target rule.** The administration UI **MUST** edit a typed draft with
appropriate controls. JSON may remain a transport contract, but **MUST NOT** be
the primary user interface.

### 2. The catalog claims capabilities that are not effective

**Observed fact.** Every `SECURITY_CONFIG_CATALOG` entry is returned with
`available: true`, although:

- `accounts.emailVerification` controls no workflow;
- `sessions.durationMinutes` is not used when sessions are created;
- dynamic password lengths only apply to recovery resets;
- sign-up, authenticated password change, and the public policy contract still
  use a startup policy built from environment variables.

The UI can consequently confirm publication without the value being effective
everywhere.

**Target rule.** An option **MUST NOT** be editable until an executable consumer
and integration test demonstrate its effect. The catalog **MUST** distinguish
`available`, `readOnly`, `effective`, and `pending`, with a stable reason for
unavailable options.

### 3. Two sources of truth control passwords

**Observed fact.** The `PasswordPolicyValidator` used by sign-up, password
change, and the public API is built at startup from `PASSWORD_*` variables.
`SecurityService` separately reloads a persisted policy and applies only its
lengths during recovery.

`PasswordPlainValueObject` is already permissive: it only checks presence and a
defensive transport bound of 1,024 code points. It no longer owns a business
minimum. This separation is correct and must become an explicit rule to prevent
regression.

**Target rule.**

- `PasswordPlainValueObject` **MUST** only protect intrinsic and defensive
  representation invariants;
- the active policy **MUST** be the sole owner of functional minimum and
  maximum lengths, strength, and optional checks;
- every use case that creates or replaces a password **MUST** receive the same
  revision-consistent policy provider;
- authentication **MUST NOT** reassess a historical password with the current
  creation policy;
- after migration, `PASSWORD_*` variables **MUST** only initialise the first
  revision and then become obsolete.

### 4. Session duration is owned by the wrong layer

**Observed fact.** `SessionEntity.createForUser` calculates expiry using a
private 60-minute constant. The centre also exposes
`sessions.durationMinutes`, whose default is 30 days. This is conceptually the
same issue as placing a configurable password minimum in its value object.

**Target rule.** The use case or policy provider **MUST** resolve the effective
duration and pass an expiry date to the entity. The entity **MUST** validate
that date but **MUST NOT** choose a configurable duration.

### 5. Configuration rules are duplicated and incomplete

**Observed fact.** Password values are validated by startup Zod configuration,
`createPasswordPolicy`, and `SecurityService.validatePolicy`. The latter checks
some bounds and dependencies but does not explicitly validate boolean types.
TypeScript types do not protect incoming JSON at runtime.

**Target rule.** A versioned policy schema **MUST** be the single source for
types, bounds, choices, and dependencies. It **MUST** validate HTTP and
persistence reads. Public form metadata **SHOULD** derive from the same catalog
to avoid validation/display drift.

### 6. Feature activation leaks into HTTP

**Observed fact.** Some options are enforced by a global hook matching URL
fragments; others are checked in `SecurityService`. The user client receives no
shared capability state with which to hide or disable affected workflows.

A new or renamed route could unintentionally bypass the hook, while a disabled
feature may remain visible until it fails with `FEATURE_DISABLED`.

**Target rule.** Every optional use case **MUST** check a stable business
capability. HTTP **MAY** reject early but must not be the sole control. A minimal
public contract **MUST** expose capability state needed by the user interface.

### 7. The publication journey is incomplete

**Observed fact.**

- the change reason is optional and may be empty;
- preview does not consistently show before/after values;
- critical reductions do not require step-up confirmation;
- the screen shows no author, reason, revision details, or restoration action;
- published and fully propagated states are not distinguished;
- component labels are hard-coded in French in a bilingual application;
- the audit log and editor share one component without dedicated navigation.

**Target rule.** Administration **MUST** have a dedicated page with a local
draft, field validation, structured preview, mandatory reason, impact-based
step-up confirmation, explicit version-conflict handling, and restorable
history. Audit remains reachable from the page but is a distinct view.

## Target catalog contract

Each catalog entry should render without hard-coding its key in the client:

```text
key, category, labelKey, descriptionKey
control: switch | number | slider-number | select | multi-select
constraints: min, max, step, unit, choices
recommendedValue, initialValue, publishedValue, effectiveValue
availability: available, readOnly, reason
impact, dependencies, incompatibilities, effectMode
```

| Value                          | Primary control                                          |
| ------------------------------ | -------------------------------------------------------- |
| enablement                     | switch with visible immediate consequence                |
| duration or short-range number | slider paired with an editable number field              |
| wide-range duration            | number field and unit selector                           |
| closed level                   | radio buttons or choice cards                            |
| affected roles                 | checkboxes or multi-select                               |
| critical value                 | normal control, then step-up confirmation on publication |

A slider **MUST NOT** be the only input for a wide range or when an exact value
matters. Every control retains a label, help text, textual error, and keyboard
operation.

## Recommended sequence

1. Make the catalog descriptive and honestly mark ineffective options.
2. Replace the `textarea` with a category-based generated form while retaining
   atomic publication.
3. Introduce a revision-consistent policy provider into IAM core.
4. Migrate every password-definition workflow and remove the competing startup
   source.
5. Inject session expiry at creation and make `sessions.durationMinutes`
   effective.
6. Move capability checks into use cases and expose required client
   capabilities.
7. Complete step-up confirmation, history, restoration, and propagation state.

Each step **MUST** add tests proving that a value shown as effective changes the
relevant behaviour.

## Exit criterion

The redesign is complete when administrators no longer edit JSON, no editable
option lacks a consumer, and one coherent policy revision controls each
operation. Entities and value objects retain their own invariants without
choosing configurable functional parameters.

## IAM correction context manifest

**Classification:** Defect Correction, Complex; security, concurrency, migration and public compatibility. **Context:** resolved for implementation; operational Work identity/Project Status activation for this correction is unavailable. Issue #44 remains discovery context, not an implementation Work State owner.

**Authority:** project method profile and the pinned Method gitlink own governance; architecture principles, dependency rules and ADR-0004/0005/0006 own boundaries; the applicable password, recovery, MFA, account-data and security-configuration specifications own behavior. ADR-0007 retains its accepted target despite the current grouped implementation. This design and the review are working context, not substitute functional approval.

**Human decisions for this correction:** preserve the final administrator access path across suspension and role removal; allow the specifically inventoried IAM package-contract migration; capture configuration per use-case execution, including nested calls, with later MFA confirmation starting a new execution. No general package-versioning policy, MFA grace period or new recovery journey is authorized.

**Evidence:** the IAM core, Kysely adapters, HTTP contracts and the disposable PostgreSQL/Redis suite. Excluded scope includes the separate session bearer/reference redesign, package relocation and deployment scheduling. Review perspectives remain separate from implementation and human validation.

**Implementation sequence:** conditional credential bookkeeping and proof generation binding; identity-bound recovery; serialized administrative invariants; historical decoding and immutable metadata; workflow projections; step-up and transport/client migration; focused and workspace validation. See [IAM security](iam-security.md) for current guarantees and remaining acceptance gaps.
