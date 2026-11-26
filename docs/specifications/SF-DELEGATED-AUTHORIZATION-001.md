# Third-Party Application Authorization

> **Identifier:** SF-DELEGATED-AUTHORIZATION-001
>
> **Artifact status:** Approved
>
> **Content status:** Canonical
>
> **Document type:** Functional Specification
>
> **Domain:** IAM / Delegated Authorization

## Work / authority context

**Work:** [#215](https://github.com/Oxelio/architecture-web/issues/215)

**Work Type:** Product Behavior Change

**Workflow Depth:** Complex

**Approval:** Human Functional Approval granted for the identified candidate

**Source Exploration:** [Work #215 exploration and scenarios](https://github.com/Oxelio/architecture-web/issues/215#issuecomment-7199671279)
and [pre-approval review](https://github.com/Oxelio/architecture-web/issues/215#issuecomment-7199915990).

**Downstream Work:** [#214 — MCP Account Management](https://github.com/Oxelio/architecture-web/issues/214).

The maintainer explicitly approved the complete functional target at the
candidate identified in section 14. This is approved target behavior, not a
statement of current implementation.

## 1. Business context

Architecture Web provides account management through its first-party application
and authenticated user sessions.

Users need to authorize approved third-party applications to access selected
capabilities of their accounts without sharing their authentication credentials.
The platform must retain control over eligible applications, permissions,
authorization lifecycle, security policies and account ownership.

Delegated authorization is an independent product capability and does not depend
on MCP or a particular external application.

## 2. Functional objective

Allow users to grant, inspect, restrict and revoke delegated access to their
accounts. Provide administrators with the ability to manage approved client
applications and their permitted capabilities.

Preserve existing account security, authorization, privacy and business policies
when operations are performed through delegated access.

## 3. Actors and authorization

| Actor              | Responsibility                                                     |
| ------------------ | ------------------------------------------------------------------ |
| User               | Grants and manages authorizations for their own account.           |
| Administrator      | Manages client applications and platform permission policies.      |
| Client Application | Requests and uses explicitly authorized delegated access.          |
| System             | Evaluates authorization, enforces policies and invalidates access. |

Administrative privileges do not implicitly authorize a client to perform
administrative operations on behalf of an administrator. Delegated administrative
operations are excluded from the initial version.

## 4. Scope and non-goals

Included:

- Client application administration through the first-party Web application.
- Client registration, configuration, activation and disablement.
- Platform-defined, resource-specific permissions.
- Required and optional consent permissions.
- Authorization creation, extension and restriction.
- Connected application consultation.
- Individual and global authorization revocation.
- Security-event invalidation.
- Security audit and user notifications.
- Account export and erasure integration.

Excluded:

- Public developer self-registration or a public application marketplace.
- Delegated administrative access.
- Machine-to-machine authorization without a user.
- MCP-specific tools and interfaces.
- Arbitrary administrator-defined permission rules.

Protocol selection, credential formats and technical lifetimes, persistence,
deployment topology and implementation architecture belong to Technical Design.
The maintainer accepts breaking changes within the authorized scope in this
pre-production project; this does not authorize unrelated behavior changes or
destructive data operations.

## 5. Functional rules and invariants

### FR-01 — Client application administration

An authorized administrator can register, consult, update, enable and disable
client applications. Registration creates a disabled application. A client
cannot obtain delegated access before explicit activation.

Each client has an identifiable identity, display information, operational status
and permitted capabilities for supported protected resources. Its identity
remains distinguishable from its mutable display name.

### FR-02 — Permission catalog and client policy

The platform defines supported permissions. An administrator can restrict the
permissions available to a client but cannot create arbitrary permissions
without a corresponding product capability.

Permissions are resource-specific and have understandable user-facing
descriptions. The platform controls the required and optional classifications for
each client and resource. A client cannot independently promote an optional
permission to a required permission.

### FR-03 — Consent request

A consent request identifies the approved client, authenticated account,
requested protected resource, required permissions and requested optional
permissions.

The system rejects requests from ineligible clients or containing unsupported or
disallowed permissions. The user may accept or deny the request and decline
optional permissions. Declining required consent prevents acceptance of the
requested authorization.

A valid first-party authenticated session and explicit consent are sufficient
for ordinary consent; this feature introduces no systematic additional
authentication. Existing authentication and account eligibility policies remain
applicable. Cancellation or denial does not modify an existing authorization.

### FR-04 — Authorization identity

At most one active business authorization exists for a given combination of
user account, client application and protected resource. Multiple technical
connections may rely on that authorization without creating competing active
business authorizations.

An authorization granted by one account cannot authorize access to another
account.

### FR-05 — Permission extension

Additional permissions require explicit user consent. A client cannot silently
acquire additional permissions because its configuration, functionality or
platform allowance changes.

Declining an extension preserves the previous authorization. Reauthorization
does not silently remove existing permissions. A previously withdrawn permission
requires new consent before it can be granted again.

### FR-06 — Permission restriction

Users can withdraw individual optional granted permissions. Withdrawal of a
required permission revokes the entire associated authorization.

Removing a permission from the platform's client policy invalidates the
corresponding granted permission. Restoring the platform allowance does not
automatically restore it. A change to required permissions invalidates
authorizations that no longer satisfy the required permission policy. New
permissions are never granted implicitly.

### FR-07 — Effective authorization

Delegated access is permitted only when all applicable conditions are satisfied:

- The client remains enabled.
- The account is eligible for access.
- The authorization remains active.
- The requested resource matches the authorization.
- The required permission remains granted and allowed.
- The presented access credential is valid and sufficiently authorized.
- Existing business and security policies permit the operation.

An unavailable or unverifiable authorization decision does not grant access. The
account targeted by a self-service operation is established from the verified
authorization, not an arbitrary client-provided account identifier.

### FR-08 — Connected applications

An authenticated user can inspect their own connected applications. The
information presented includes application identity and display information,
protected resource, granted permissions, authorization date and current
authorization status.

Users can withdraw optional permissions, revoke an individual authorization or
revoke all their delegated authorizations. Revocation does not require
cooperation from the client application.

### FR-09 — Revocation

A revoked authorization no longer authorizes new operations or renewal of
delegated access. Revocation applies to every technical credential associated
with that authorization.

Repeated revocation does not create duplicate business effects or visible
notifications. A revoked authorization cannot be restored silently. Subsequent
access requires a new authorization. Credentials associated with a previous
revoked authorization never regain validity when a new authorization is granted.

### FR-10 — Session independence

Ordinary first-party sign-out, web-session expiration and individual session
revocation do not automatically revoke delegated authorizations. Revoking a
delegated authorization does not automatically revoke first-party sessions.

Account-wide security invalidation follows FR-11.

### FR-11 — Account security invalidation

All delegated authorizations associated with an account are revoked following
these successful security-sensitive transitions:

- Authenticated password replacement.
- Password replacement through account recovery.
- Effective replacement of a login identity.
- MFA activation.
- MFA deactivation.
- MFA backup-code regeneration.
- Account suspension.
- Accepted account-deletion request.

The security effect must not depend exclusively on delayed notification or audit
processing. Account reactivation and deletion cancellation do not restore
previously revoked authorizations. Ordinary sign-out is not a security
invalidation event.

### FR-12 — Client disablement

Disabling a client prevents new authorization and delegated access. All existing
authorizations associated with that client are revoked. Re-enabling it does not
restore revoked authorizations. Users must explicitly authorize it again before
delegated access resumes.

### FR-13 — Sensitive administrative operations

Security-critical client administration requires an authorized administrator and
operation-bound step-up authentication. Critical operations include:

- Enabling a client.
- Disabling a client.
- Modifying trusted client identity or security-sensitive configuration.
- Modifying the client's permitted or required permission policy.

The administrator confirms the exact intended operation using their current
password and the applicable current MFA policy. The confirmation is bound to the
actor, originating session and submitted operation; it authorizes only that
attempt.

Final authorization must be reached within two minutes of receipt of the
submitted confirmation and before the originating session expires. At the
deadline the proof is invalid. The final authorization checks that the actor
remains authorized and that the proof and session remain valid for the exact
operation. Expired, replayed, insufficient or stale confirmations cannot
authorize a critical operation.

An administrator account may initiate at most five admitted credential
verification attempts in any rolling five-minute window, shared across
client-administration operations and sessions for that account. This allowance
is distinct from the configuration-publication and restoration allowance in
[SF-SECURITY-CONFIG-001](SF-SECURITY-CONFIG-001.md). Confirmation does not
extend the originating session's lifetime.

### FR-14 — Authorization lifetime

A business authorization remains valid until revoked or invalidated. Technical
access credentials remain time-limited and subject to current authorization and
security policies. Expiration of a technical credential does not itself revoke
the underlying authorization.

### FR-15 — Final consent authorization

Before establishing or extending an authorization, the system establishes that:

- The originating authenticated session remains valid.
- The user remains eligible.
- The client remains enabled.
- The resource and requested permissions remain eligible.
- The consent request remains valid.
- The relevant authorization lifecycle has not been invalidated.

A stale consent request cannot recreate access following revocation, account
security invalidation or client disablement. A fresh eligible consent request is
required. Concurrent requests preserve the single-active-authorization
invariant.

### FR-16 — Revocation consistency

Once revocation or permission withdrawal becomes effective, subsequent
authorization decisions and access renewal reject the invalidated access.

An already admitted operation may complete under its original authorization
unless its own approved security or business rules require a stricter
consistency boundary. Revocation does not guarantee retroactive cancellation of
completed operations or external processing. Previously disclosed data cannot be
recalled by revocation.

Operation-specific stricter guarantees belong to the corresponding functional
specification.

## 6. States and significant transitions

### Client application

A client is Disabled or Enabled. Registration creates a disabled client;
explicit administrative activation enables it. Administrative disablement
revokes existing authorizations.

### Authorization

An authorization is Active or Revoked. Successful consent establishes or
extends an active authorization. Explicit revocation and applicable security or
client policy invalidation terminate or restrict access as defined by FR-06,
FR-09, FR-11 and FR-12.

Subsequent authorization establishes a new grant lifecycle rather than restoring
revoked access. Consent denial and cancellation are request outcomes, not
persistent authorization states.

## 7. Functional dependencies and interactions

IAM owns account eligibility, authentication and delegated authorization. Audit
owns security event retention, consultation and applicable erasure rules.
Notifications owns notification delivery policies, channels and recipients.

Review and synchronize the following existing functional owners where this
target changes their behavior:

- [SF-SESSION-001](SF-SESSION-001.md)
- [SF-PASSWORD-001](SF-PASSWORD-001.md)
- [SF-MFA-001](SF-MFA-001.md)
- [SF-ACCOUNT-RECOVERY-001](SF-ACCOUNT-RECOVERY-001.md)
- [SF-ACCOUNT-DATA-001](SF-ACCOUNT-DATA-001.md)
- [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md)
- [SF-SECURITY-CONFIG-001](SF-SECURITY-CONFIG-001.md)
- [SF-NOTIFICATIONS-001](SF-NOTIFICATIONS-001.md)

This specification owns delegated authorization lifecycle and permission rules.
Existing owners retain their respective responsibilities. Link to this owner
rather than duplicate its revocation matrix. Existing approved behavior remains
effective except where an explicitly accepted change takes effect.

## 8. Observable behavior / UX expectations

### Administrator experience

The first-party administration interface provides client listing and details,
registration and configuration, permitted capability management, activation and
disablement, clear presentation of critical changes and explicit confirmation
where required. Disablement explains that existing authorizations will be
revoked.

### User consent experience

The consent interface clearly identifies the client and authenticated account.
Required and optional permissions are distinguishable and understandable. Users
can explicitly authorize or deny access. Additional permissions require explicit
consent.

### Connected application experience

Account settings provide a dedicated connected applications area. Users can
inspect granted permissions, withdraw eligible permissions and revoke access.
The consequences of withdrawing required permissions or revoking an
authorization are understandable before confirmation. An unavailable or already
revoked authorization is not presented as active.

## 9. Errors, edge cases and failure behavior

Handle unknown or disabled clients, invalid or unsupported permissions, denied
or cancelled consent, expired or invalid requests and credentials, cross-account
access attempts, insufficient authorization, ineligible accounts, concurrent
consent and revocation, permission-policy changes during authorization,
concurrent client disablement and delegated operations, stale administrative
confirmations and unavailable authorization dependencies.

Expected authorization refusals are distinguishable from unexpected technical
failures. Technical failure is not interpreted as successful authorization or
revocation. Repeated requests cannot create duplicate active business
authorizations. A successful revocation is reported only after the applicable
invalidation guarantee is established.

## 10. Security and privacy requirements

- Never share first-party authentication credentials with client applications.
- Never expose raw bearer session identifiers, passwords, MFA secrets or
  recovery codes.
- Bind delegated access to the authenticated account and intended protected
  resource.
- Enforce least privilege and current business authorization.
- Prevent unauthorized privilege escalation.
- Do not rely on external applications or AI models as security enforcement
  boundaries.
- Minimize exposed personal information.
- Exclude credentials from audit records and notifications.
- Preserve account export, retention and erasure obligations.

### Security audit

Record attributable client administration changes, authorization creation,
permission changes, revocation and relevant denied security attempts. Follow
[SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md), including its existing
minimized personal Audit projection, acceptance, retention and erasure policy.

### Security notifications

Notify affected users when a new authorization is granted, additional permissions
are granted or an authorization is revoked. Bulk revocation produces one grouped
notification per affected user and logical revocation operation. Repeated
processing of the same business fact cannot create duplicate visible
notifications.

Use the first-party Web notification center and mandatory email when an eligible
verified destination and configured provider are available. Notification failure
does not restore invalidated access. Delivery and erasure eligibility remain
governed by [SF-NOTIFICATIONS-001](SF-NOTIFICATIONS-001.md). Final account
erasure generates no additional notification.

### Account data and erasure

Account export includes the user's own non-secret authorization data. It never
includes access credentials, client secrets or another account's data.

An accepted deletion request revokes all associated delegated authorizations
(FR-11). Final erasure removes account-linked authorization data and credentials
subject to applicable documented retention obligations. Retained security audit
evidence follows [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md). Deletion
cancellation does not restore revoked access.

## 11. Functional alternatives considered

The maintainer selected independent authorizations over reuse of first-party
sessions, platform-approved clients over open developer registration, required
and optional permissions over all-or-nothing consent, one active grant per
account/client/resource over per-connection grants, permanent invalidation over
temporary suspension on client disablement, and validity until revocation over
periodic consent renewal.

## 12. Open functional decisions

No unresolved functional decision is identified within the confirmed V1 scope.
Human Functional Approval has been granted for the complete scope in section 14.

Technical Design must establish protocol and partial-consent interoperability,
credential lifecycle, consistency mechanisms, and architecture. If feasibility
reveals a required behavioral change, return it to the functional owner for
explicit decision; do not weaken this target silently.

The downstream MCP Work owns its specific tool and UI scope and any stricter
operation-specific admission or confirmation rules.

## 13. Acceptance criteria

### Client administration

- [ ] Registration creates a disabled client.
- [ ] Only authorized administrators can manage clients.
- [ ] Critical changes require valid operation-bound confirmation.
- [ ] Expired, replayed or stale confirmations are rejected.
- [ ] The two-minute deadline and separate account-wide five-attempt rolling
  allowance are enforced.
- [ ] Disabled clients cannot obtain or use delegated authorization.
- [ ] Re-enabling a client does not restore revoked authorizations.

### Consent and permission management

- [ ] Requests exceeding client permissions are rejected.
- [ ] Required and optional permissions are clearly presented.
- [ ] Clients cannot change the platform's required/optional classification.
- [ ] Optional permissions can be declined without granting them.
- [ ] Declining required consent prevents authorization.
- [ ] Denied or cancelled consent preserves existing authorization.
- [ ] Concurrent requests cannot create duplicate active authorizations.
- [ ] Additional permissions require explicit consent.
- [ ] Users can withdraw optional permissions.
- [ ] Withdrawing required permissions revokes the authorization.
- [ ] Required-policy changes invalidate noncompliant authorizations.
- [ ] Removed permissions cannot authorize subsequent operations.
- [ ] Reintroducing permissions does not silently restore access.
- [ ] Stale consent cannot recreate revoked authorization.

### Delegated access and lifecycle

- [ ] Users can consult and revoke their own authorizations individually and
  collectively.
- [ ] Access to another user's resources is denied.
- [ ] Invalid or insufficiently authorized credentials are rejected.
- [ ] Credentials cannot authorize access to an unintended resource.
- [ ] Revocation invalidates associated access and renewal capabilities.
- [ ] Previous credentials remain invalid after reauthorization.
- [ ] Ordinary web sign-out, expiration and individual session revocation
  preserve independent authorizations.
- [ ] Delegated revocation does not revoke ordinary first-party sessions.
- [ ] Every security transition listed in FR-11 invalidates account
  authorizations.
- [ ] Account reactivation and deletion cancellation do not restore access.
- [ ] Delegated access preserves existing product and security policies.
- [ ] Authorization dependency failure does not grant access.
- [ ] Concurrent authorization and revocation preserve FR-15 and FR-16,
  including denial of every new authorization decision after invalidation.

### Audit, notifications and privacy

- [ ] Administrative changes and authorization lifecycle events produce the
  expected audit evidence without credentials.
- [ ] New grants, permission expansions and revocations generate the expected
  notifications.
- [ ] Bulk revocation produces one grouped notification per affected user and
  logical operation.
- [ ] Web and mandatory email policy applies when eligible.
- [ ] Repeated processing does not duplicate visible notifications.
- [ ] Notification failure does not restore revoked access.
- [ ] Account export includes the user's eligible authorization data without
  credentials.
- [ ] Final erasure removes authorization data under applicable policies.
- [ ] Final erasure does not generate an additional notification.

## 14. Human approval

**Decision:** Approved — 2026-11-26.

**Approved scope:** The complete V1 functional scope, FR-01–FR-16 and
acceptance criteria at [candidate commit d992b51bb6530d257212fd98b46d24640aa2be68](https://github.com/Oxelio/architecture-web/blob/d992b51bb6530d257212fd98b46d24640aa2be68/docs/specifications/SF-DELEGATED-AUTHORIZATION-001.md), PR #216.

**Authority / record:** Architecture Web maintainer, [explicit approval recorded in Work #215](https://github.com/Oxelio/architecture-web/issues/215#issuecomment-7200073282).

This document is an approved functional target. It does not establish current
implementation behavior, approve structural decisions or authorize
implementation before applicable preparation and readiness activities.
