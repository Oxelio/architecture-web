# Account recovery and password reset

> **Identifier:** SF-ACCOUNT-RECOVERY-001
>
> **Status:** Accepted
>
> **Functional dependencies:**
> [SF-PASSWORD-001](SF-PASSWORD-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Business context

A user can create an account, verify their address, sign in, and change their
password while they still know the current password. They cannot recover the
account after forgetting it.

This missing journey can make an account permanently inaccessible. It must be
added without disclosing whether an address is registered, weakening the
password policy, or leaving potentially compromised sessions active.

## Functional objective

Allow the owner of an email address associated with an account to set a new
password through a temporary, confidential, single-use link.

The journey includes:

1. requesting recovery;
2. optionally sending a message;
3. validating a temporary token;
4. setting the new password;
5. revoking existing sessions;
6. notifying the owner of the change.

## Actors

- an unauthenticated visitor requesting recovery;
- the mailbox owner using the received link;
- the email delivery system;
- an administrator, only when viewing authorized events: an administrator
  cannot read a token or choose a password for the user.

## Recovery request

The request accepts an email address. After minimal syntax validation, the
public response remains the same when:

- the address belongs to no account;
- the account is suspended;
- the address has not been verified;
- a recent request already exists;
- message delivery has been rate-limited.

The response only confirms that instructions will be sent if the account is
eligible. It returns no user identifier, status, or precise delay from which
account existence could be inferred.

Requests are rate-limited per known account and per technical origin. Thresholds
are configurable. Abuse must neither produce unlimited messages nor permanently
block a legitimate user.

## Reset token

For an eligible account, the system generates a random token distinct from
session and email-verification tokens.

The token:

- initially expires after 30 minutes, with a configurable duration;
- can be used only once;
- is invalidated when a new token is issued for the same account;
- is never persisted, logged, or sent to a third party in usable form;
- discloses no account data;
- is compared through a non-reversible representation.

Token consumption and password storage form one consistent operation: two
concurrent uses cannot both succeed.

Public errors for an unknown, expired, consumed, or invalidated token are
equivalent.

## Setting the new password

The user provides the new password and its confirmation. The policy from
[SF-PASSWORD-001](SF-PASSWORD-001.md) applies at the level corresponding to the
account role.

A successful reset:

- replaces the password;
- consumes the token;
- revokes every session for the account;
- does not automatically sign the user in;
- prompts the user to sign in again;
- sends a confirmation message containing no secret.

The confirmation email contains neither the password nor a session token. It
explains how to react when the owner did not initiate the change.

## Special account states

- A suspended account can replace its password with a valid token, but remains
  suspended and cannot sign in.
- Resetting a password does not implicitly verify an unverified address.
- Changing the email address invalidates tokens sent to the old address.
- An authenticated password change invalidates active recovery tokens.
- Deleting an account, or marking it for deletion, invalidates its tokens.

## Security and privacy

Logs contain no password, confirmation, or usable token. Security events may
contain the outcome, timestamp, a non-public account reference, and strictly
necessary network information.

The system limits observable content and HTTP-status differences between known
and unknown accounts. Strictly constant response time is not required, but no
branch may intentionally make enumeration easier.

## User experience

The interface provides:

- a “Forgot password” link from sign-in;
- a request form with a generic confirmation;
- a page for choosing the new password;
- the existing password requirements and confirmation;
- a clear state when the link can no longer be used;
- a return to sign-in after success.

Refreshing the page or double-clicking must not present a second reset as
successful.

## Test scenarios

Tests cover at least:

1. equivalent responses for known and unknown accounts;
2. repeated-request rate limiting;
3. token expiry, invalidation, and single use;
4. invalidation of the previous token after a new request;
5. rejection of mismatched passwords;
6. normal and privileged password policies;
7. atomic success under two concurrent consumptions;
8. revocation of every session;
9. absence of automatic sign-in;
10. preservation of suspension;
11. absence of implicit email verification;
12. invalidation after email change, authenticated password change, or deletion;
13. absence of secrets from responses, messages, and logs.

## Acceptance criteria

The feature is complete when the full journey works without revealing account
existence, every token is temporary and single-use, the existing password policy
is reused, all sessions are revoked after success, and concurrency and abuse
cases are covered by tests.

## Out of scope

This specification does not include:

- recovery of a lost mailbox;
- disabling a lost second factor;
- administrator-defined passwords;
- security questions;
- automatic authentication after reset;
- a manual identity-proofing procedure.
