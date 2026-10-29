# ADR-0006 — Separate accounts, login identities, and authenticators

**Status: accepted**

## Context

`UserEntity` used to combine account existence, email address, and password.
That model made email mandatory and conflated three different lifecycles: the
account, how it is located, and the proof used to authenticate. In particular,
it prevented a minimal pseudonymous account with no collected email address.

## Considered options

1. Keep every optional field in `UserEntity`.
2. Make every identity and authenticator a child of one large `User` aggregate.
3. Define separate roots linked only by the account identifier.

## Decision

IAM separates the following responsibilities:

- `UserEntity` represents the account, its role, status, and session version;
- `LoginIdentityEntity` represents a normalized identifier (`username` or
  `email`) and its optional verification;
- `PasswordAuthenticatorEntity` represents the password derivative and its
  lifecycle;
- `EmailVerificationEntity` targets one precise login identity rather than
  only a user.

These concepts are separate aggregate roots. They refer to one another through
identifier value objects, and coordinated writes use `IamUnitOfWork`.
`UserRepository` remains a command port limited to the `UserEntity` root;
`UserQueryRepository` builds read projections that join accounts and
identities.

The account policy exposes allowed login identifier kinds and applies them to
both sign-up and sign-in. Verification only applies to an email identity and
remains configurable. Email is consequently optional in read contracts.

Profile data such as first name, last name, phone, or avatar is not added to
IAM. It belongs in a dedicated profile context once real business requirements
define its rules and lifecycle.

## Consequences

- an account can operate with only a username and password;
- adding a new identity or authenticator kind does not enlarge the user root;
- database constraints protect global uniqueness by identifier kind and
  normalized value;
- each user has at most one identity of each kind and one password
  authenticator;
- commands spanning several roots must remain transactional;
- read consumers must support a missing email address;
- removing an identifier kind from policy prevents its use for new sign-ups
  and sign-ins.

## Limits

This decision does not yet provide phone identities, passkeys, federation, or
passwordless authentication. Those extensions must introduce their complete
domain objects, ports, migrations, policies, and journeys before being
advertised as available.
