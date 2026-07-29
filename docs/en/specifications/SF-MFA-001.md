# Multifactor authentication with an authenticator application

> **Identifier:** SF-MFA-001
>
> **Status:** Accepted
>
> **Functional dependencies:**
> [SF-ACCOUNT-RECOVERY-001](SF-ACCOUNT-RECOVERY-001.md),
> [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Business context

Authentication currently relies on a password. Compromising that single secret
is therefore enough to open a session. Administrator accounts pose a particular
risk because of their permissions.

## Functional objective

Allow a user to add a second factor based on a TOTP-compatible authenticator
application. Provide recovery codes so temporary loss of the application does
not immediately make the account inaccessible.

The first version makes MFA optional for ordinary accounts and allows a
deployment policy to require it for administrators.

## Enrollment

Enrollment requires:

1. a recent authenticated session;
2. fresh password verification;
3. generation of a TOTP secret;
4. presentation as a QR code and manual value;
5. entry of a first valid code;
6. generation of recovery codes;
7. explicit confirmation that the codes were saved.

MFA becomes active only after the first code is validated. An abandoned or
expired enrollment does not change the account.

The TOTP secret is displayed only during enrollment. It is encrypted at rest and
never returned after activation.

## Recovery codes

The system initially generates ten independent recovery codes:

- each code can be used once;
- only non-reversible derivatives are stored;
- plain codes are displayed once;
- regeneration immediately invalidates every previous code;
- the user can view the remaining count, never the values.

Using or regenerating codes creates a security event. The user receives a
warning when few codes remain.

## Signing in with MFA

After password validation, a protected account does not yet receive a fully
authenticated session. It must provide:

- a valid TOTP code; or
- an unused recovery code.

The challenge is temporary, bound to the sign-in journey, and unusable for other
API operations. Attempts are rate-limited, and entering the correct password
again must not bypass that limit.

Errors do not reveal whether a code was nearly valid, already used, or belonged
to another account. A small time tolerance may handle clock drift without
accepting the same code multiple times within one challenge.

Trusted devices are excluded from this version: every new session requires the
second factor.

## Management and deactivation

A user can view MFA status, activation time, and the count of remaining recovery
codes.

Regenerating codes requires recent authentication, the password, and a valid
second factor.

Deactivation requires the same checks. It revokes every session, consumes the
current challenge, and requires a new sign-in. A policy requiring MFA for
administrators rejects deactivation while the role remains.

Activation revokes the account’s other sessions so they do not remain open
without satisfying the new protection level.

## Interaction with other journeys

- A password reset never disables MFA.
- An email change never disables MFA.
- Suspension preserves MFA configuration.
- Account deletion removes the secret and recovery-code derivatives.
- Promotion to a role requiring MFA may create a limited enrollment period; at
  its expiry, no new full session is allowed before activation.
- Simultaneous loss of the password, application, and recovery codes requires a
  separate strengthened-recovery procedure.

## Notifications and audit

The user receives a secret-free notification after:

- activation or deactivation;
- recovery-code regeneration;
- recovery-code use;
- repeated failures suggesting an attack.

Related events follow [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md).

## Test scenarios

Tests cover at least:

1. complete enrollment and abandonment without activation;
2. rejection when the session or password check is no longer recent;
3. secret not exposed after activation;
4. sign-in impossible without a second factor;
5. valid, invalid, expired, and replayed TOTP codes;
6. attempt rate limiting;
7. single use of all ten recovery codes;
8. invalidation of old codes after regeneration;
9. deactivation with all required checks;
10. rejected deactivation for a policy-protected role;
11. session revocation on activation and deactivation;
12. preservation of MFA after password reset;
13. secret deletion with the account;
14. notifications and events containing no secret.

## Acceptance criteria

The feature is complete when enrollment proves the first code, no full session
is created without a second factor, recovery codes are single-use, secrets are
protected, role policies are enforced, and every sensitive change is notified
and audited.

## Out of scope

This specification does not include:

- SMS or email as a second factor;
- WebAuthn, passkeys, or hardware keys;
- trusted devices;
- push approval;
- manual support recovery;
- adaptive risk-based policies;
- federation with an external identity provider.
