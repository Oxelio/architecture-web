# Account data export and deletion

> **Identifier:** SF-ACCOUNT-DATA-001
>
> **Status:** Accepted
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

- the grace-period duration;
- immediate loss of access;
- data intended for deletion;
- data that may be retained and why;
- consequences for an administrator account.

After strengthened verification, the user explicitly confirms deletion. The
account then remains pending deletion for 14 days:

- every session is revoked;
- normal sign-in is denied;
- active tokens are invalidated;
- no new export can be requested;
- a confirmation and cancellation message is sent to the verified address.

The grace period is configurable. Final deletion occurs only after it expires.

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
14. explicit behavior under a retention obligation.

## Acceptance criteria

The feature is complete when a user can obtain a portable archive containing no
secret, downloads are temporary and protected, deletion immediately revokes
access, cancellation works during the grace period, final erasure handles every
declared category, and any remaining retention is bounded and explained.

## Out of scope

This specification does not include:

- a legal conclusion about deployment compliance;
- administrator export of another user’s data;
- automatic ownership transfer for future business resources;
- restoration after final deletion;
- deletion from backups before their normal rotation;
- an operator portal for legal requests.
