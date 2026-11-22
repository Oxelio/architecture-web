# Account data export and deletion

> **Identifier:** SF-ACCOUNT-DATA-001
>
> **Lifecycle:** Approved
>
> **Content status:** Canonical
>
> **Work #174 amendment:** Approved Target for the defined correction scope.
> **Human Functional Approval:** 2026-11-22, recorded in
> [Work #174 approval](https://github.com/Oxelio/architecture-web/issues/174#issuecomment-7084672138).
> The existing `Approved` lifecycle refers to the baseline on `main`.
> Approval of this amendment does not make its implementation effective, and
> does not approve a specific HTTP contract or migration strategy.
>
> **Document type:** Functional Specification
>
> **Domain:** Identity and Access Management
>
> **Functional dependencies:**
> [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Business context

A user can manage identifiers and sessions, but cannot obtain a structured copy
of data associated with the account or request its deletion. IAM data spans
user persistence, sessions, verifications, and eventually the audit trail.

## Functional objective

Allow a user to:

1. request a comprehensible, portable export of their data;
2. download that export securely;
3. request account deletion;
4. cancel the request during a grace period;
5. clearly understand which data is deleted, anonymized, or retained.

This specification defines product behavior. Final legal compliance depends on
the deployment context and requires separate validation.

## Strengthened authorization

Export and deletion require a recent authenticated session and fresh password
verification. When MFA is active, a valid second factor is also required.

These operations are rate-limited and audited. An administrator cannot download
a user’s personal export or delete the account through this self-service
journey.

## Export

The user can request an archive containing at least:

- account identifier, email, role, status, and timestamps;
- email-verification state;
- sessions and retained session metadata;
- security events visible to the user;
- retained history of export and deletion requests.

The archive never includes:

- password hashes;
- tokens or cookies;
- MFA secrets or recovery-code derivatives;
- another user’s data;
- non-disclosable internal notes or metadata;
- configuration secrets or raw technical logs.

The initial format is a ZIP archive containing documented, versioned UTF-8 JSON
files. Dates use an unambiguous format, and absent fields remain distinct from
unknown values.

## Generation and download

Generation may be asynchronous. A request has a `pending`, `ready`, `expired`,
or `failed` state.

When the archive is ready:

- the user receives a notification without an attachment;
- download requires valid authentication;
- the link expires after 24 hours;
- the archive is deleted at expiry or after the first successful download;
- no durable or publicly shareable URL is produced.

A new request must not create unnecessary concurrent archives. A failure does
not disclose internal generation details.

## Deletion request

Before confirmation, the interface explains:

- the **effective configured grace-period duration** applicable to the request;
- immediate loss of access;
- data intended for deletion;
- data that may be retained and why;
- consequences for an administrator account, including the inability of the
  last active administrator to delete their own account.

The explanation is presented before any deletion request is submitted, in the
user's selected supported language. The displayed duration is obtained from the
effective configuration, not from its default value. The user explicitly
confirms that duration together with the other disclosures.

If the effective duration cannot be obtained, the user cannot confirm deletion
and can retry obtaining the information. No default duration is substituted.
When account deletion is disabled, the user cannot submit a deletion request.

If the effective grace-period duration changes after disclosure but before the
request is accepted, the previous confirmation does not authorize deletion
under the changed duration. The request is not accepted, and the user must see
and explicitly confirm the current duration before trying again.

### Disclosure for previously authorized deliveries

The pre-confirmation disclosure also explains: “A notification attempt authorized
before final account erasure may still be sent or arrive afterward.” The
[Work #120 decision](https://github.com/Oxelio/architecture-web/issues/120#issuecomment-6744329606)
applies in the existing deletion-request flow. Final erasure generates no
confirmation message. Delivery eligibility is owned by
[SF-NOTIFICATIONS-001](SF-NOTIFICATIONS-001.md#delivery-eligibility-after-final-account-erasure).

### Deletion request confirmation

After strengthened verification and explicit confirmation of the effective
grace-period duration, the account remains pending deletion for that configured
duration. The initial default is 14 days; it is not necessarily the effective
duration of any given request. Once the request is accepted:

- every session is revoked;
- normal sign-in is denied;
- active tokens are invalidated;
- no new export can be requested;
- a confirmation and cancellation message is sent to the verified address.

The accepted request's scheduled deletion date reflects the effective duration
confirmed for that request. Subsequent configuration changes do not silently
reschedule an already accepted request. Final deletion occurs only after the
grace period applicable to that request expires.

## Cancellation

During the grace period, the owner can cancel through a temporary link sent to
the verified address and strengthened verification. The cancellation token is
single-use, expires no later than the grace period, and follows the same
confidentiality requirements as recovery tokens.

Cancellation restores access according to the account’s previous status without
restoring revoked sessions. A previously suspended account remains suspended.

## Final deletion

At expiry, the system deletes:

- the account and active identifiers;
- the password hash;
- sessions;
- verification, recovery, and cancellation tokens;
- MFA secrets and recovery codes;
- export archives;
- technical data with no retention duty.

Audit events still required remain only until their expiry under
[SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md), with direct account
references removed or pseudonymized.

A documented legal obligation may delay deletion of specific data. The user is
informed of this possibility without receiving information that could
compromise an investigation.

## Administrator accounts and dependencies

The last active administrator cannot request deletion until another active
administrator exists. The rejection explains the corrective action without
exposing another account.

If the account later owns resources in other bounded contexts, each context
declares its policy: deletion, anonymization, transfer, or justified blocking.
IAM must not announce complete deletion before those processes finish.

## Test scenarios

Tests cover at least:

1. strengthened verification for export and deletion;
2. expected archive contents and exclusion of every secret;
3. strict isolation between users;
4. generation, failure, and expiry states;
5. single download and archive deletion;
6. immediate session revocation on a deletion request;
7. inability to sign in during the grace period;
8. valid, expired, replayed, and suspended-account cancellation;
9. final deletion of every declared data category;
10. pseudonymization and bounded audit retention;
11. rejection for the last active administrator;
12. idempotence of scheduled processing;
13. notifications and audit events;
14. explicit behavior under a retention obligation;
15. all required deletion disclosures before confirmation, including data
    intended for deletion, possible retention and reasons, administrator-account
    consequences, and the previously authorized delivery warning;
16. the effective configured duration, including a non-default duration and
    the supported minimum and maximum, displayed correctly in FR/EN;
17. unavailable effective-duration information and disabled deletion preventing
    confirmation or mutation, without substitution of a default;
18. a duration change between disclosure and acceptance requiring fresh
    disclosure and explicit confirmation, without accepting the stale request;
19. language changes, failed reads, and repeated confirmation attempts not
    triggering an unintended or duplicate deletion request.

## Acceptance criteria

The feature is complete when a user can obtain a portable archive containing no
secret, downloads are temporary and protected, deletion immediately revokes
access, and all approved deletion consequences and the effective grace-period
duration are explained before explicit confirmation. Missing duration
information prevents confirmation; a changed duration requires renewed
confirmation before acceptance. Cancellation works during the grace period,
final erasure handles every declared category, and any remaining retention is
bounded and explained.

## Out of scope

This specification does not include:

- a legal conclusion about deployment compliance;
- administrator export of another user’s data;
- automatic ownership transfer for future business resources;
- restoration after final deletion;
- deletion from backups before their normal rotation;
- an operator portal for legal requests.
