# Security event audit trail

> **Identifier:** SF-SECURITY-AUDIT-001
>
> **Lifecycle:** Approved
>
> **Content status:** Canonical
>
> **Document type:** Functional Specification
>
> **Domain:** Audit / Security
>
> **Functional dependencies:**
> [SF-ACCOUNT-RECOVERY-001](SF-ACCOUNT-RECOVERY-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Business context

The IAM module performs sensitive operations: sign-ins, identifier changes,
session management, and administrative actions. Without a centralized history,
it is difficult to explain a change, investigate an incident, or distinguish a
legitimate action from abuse.

A general application log is not an audit trail: it may be incomplete, overly
technical, mutable, and contain secrets.

## Functional objective

Create a durable, queryable, and minimized history of security events that can
answer:

- what action was attempted;
- when and with what outcome;
- by which known or anonymous actor;
- against which account;
- from which approximate context;
- under which correlation reference for further investigation.

The trail supports investigation and user information. It must not become an
authorization mechanism or block a business operation during temporary
unavailability unless an explicit policy says otherwise.

## Events in scope

The first version records at least:

- successful and rejected sign-ins and sign-outs;
- account creation and email verification;
- account-recovery requests and successful resets;
- password and email changes;
- session creation and revocation;
- account activation, suspension, and role changes;
- MFA activation, recovery-code use, and deactivation when
  [SF-MFA-001](SF-MFA-001.md) is available;
- export request, generation, and download;
- account-deletion request, cancellation, and execution.

Repeated events may be grouped for display, but facts needed for an
investigation must not be lost.

## Functional model

Each event contains at least:

```text
Security event
- identifier
- stable type
- occurrence time
- outcome: success, rejection, or technical failure
- actor: user, administrator, system, or anonymous
- optional affected subject
- optional correlation identifier
- optional minimized client and network context
- event-specific metadata
```

A change keeps old and new values only when necessary and non-sensitive. A role
or status change may keep them; a password, token, MFA secret, and cookie never
may.

## Integrity and ordering

The trail is append-only. No user, including an administrator, can edit or
selectively delete an event through the application.

Each event has a stable identifier and a system-assigned timestamp. Queries use
a deterministic newest-first order and bounded pagination.

A successful business operation must not be presented as audited before its
event has been durably accepted. The recovery strategy for storage
unavailability avoids visible duplicates and documents any remaining loss risk.

## Querying and authorization

An authenticated user may view useful security events concerning their own
account, without internal metadata or more administrator identity than needed.

An administrator may query events within their permissions and filter by:

- time period;
- type and outcome;
- known actor or subject;
- correlation identifier.

A non-administrator can neither query another account’s events nor infer their
existence. Viewing the audit trail is itself audited.

## Personal data and secrets

The audit trail must never contain:

- passwords or confirmations;
- session, recovery, or verification tokens;
- MFA secrets or recovery codes;
- full email contents;
- authorization headers;
- unfiltered request bodies.

IP address and client information are optional, protected as personal data, and
shown only to authorized actors. Anonymous attempts must not lead to indefinite
storage of a plain-text email address; a pseudonymous reference may support
abuse detection.

## Retention and deletion

The initial retention period is 12 months and is configurable. Deployment
context may require a different duration.

At expiry, events are deleted or irreversibly aggregated. After account
deletion, events still required for security may remain until expiry, but direct
account references are removed or pseudonymized.

A documented legal hold may pause a relevant purge. It does not permit silently
expanding collection.

## Test scenarios

Tests cover at least:

1. an event for each sensitive operation;
2. distinction between success, business rejection, and technical failure;
3. stable ordering and bounded pagination;
4. administrative filters;
5. owner-only views;
6. rejection of cross-account access;
7. inability to edit or selectively delete an event;
8. absence of every secret;
9. pseudonymization of anonymous attempts;
10. auditing of administrative queries;
11. expiry purge and deleted-account handling;
12. defined behavior during audit-storage unavailability.

## Acceptance criteria

The feature is complete when sensitive operations produce structured,
queryable events, authorization prevents cross-account access, secrets are
excluded, retention is enforced, and write-failure behavior is explicit and
tested.

## Out of scope

This specification does not include:

- a complete SIEM or fraud-detection engine;
- event-based automatic blocking;
- unlimited retention;
- exhaustive recording of all HTTP requests;
- manual editing of history;
- cryptographic non-repudiation guarantees.
