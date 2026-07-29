# Password policy

## Architecture

The policy is centralized in the `iam` core and is independent from HTTP,
Zod, and hashing implementations. `PasswordPolicyValidator` receives ports for
strength evaluation, common-password detection, and compromised-password
detection. The API currently composes a heuristic evaluator and two small,
replaceable local lists.

The plaintext password value object intentionally remains permissive so
existing accounts can still authenticate. The active policy applies only when
a password is created or replaced.

Length is measured in **Unicode code points**. Values are never normalized,
trimmed, or truncated. Spaces, Unicode, and passphrases are accepted.

## Levels and defaults

| Level                |                   Minimum | Minimum strength |
| -------------------- | ------------------------: | ---------------- |
| `standard`           |                        12 | `weak`           |
| `elevated` (default) |                        15 | `acceptable`     |
| `critical`           |                        20 | `strong`         |
| `custom`             | configurable, based on 15 | configurable     |

The default maximum is 128 and cannot be configured below 64. Composition
requirements are disabled by default. Administrator password changes use the
`critical` level by default.

## Configuration

The latest published security-centre revision is the sole policy source.
`SecurityService` implements `IamPolicyProvider` and builds the standard or
privileged policy used by `PasswordPolicyValidator` on demand.

The versioned schema in `apps/api/src/security/security-policy.ts` defines
levels, lengths, checks, and composition rules. Previous `PASSWORD_*` startup
variables have been removed. Sign-up, authenticated change, the public
contract, and evaluation now use the same persisted revision. Recovery still
validates inside `SecurityService` and must move to the shared validator to
cover checks beyond length.

## HTTP contracts

- `GET /v1/iam/password-policy` exposes public requirements;
- `POST /v1/iam/password-policy/evaluate` returns `valid`, a stable
  strength category, and error codes without returning the password;
- sign-up requires `password` and `passwordConfirmation`;
- password change requires `currentPassword`, `password`, and
  `passwordConfirmation`.

The new required fields are breaking changes to both previous write contracts.

## Hashing and compatibility

The API uses Argon2id. The bcrypt adapter now SHA-256 prehashes new values and
marks them with `bcrypt-sha256:` to prevent bcrypt's 72-byte truncation. It
retains a verification path for unmarked legacy bcrypt hashes. Existing
passwords are not reevaluated at sign-in.

## Current limitations

The reset flow applies dynamic length bounds only and does
not call `PasswordPolicyValidator`. Invitation, activation-with-password, and
administrative password-definition flows remain absent.

Password history is not represented in persistence; only reuse of the current
password is rejected. Embedded local lists are a minimal fallback. Sensitive
deployments should inject a maintained dataset or privacy-preserving service.
No remote service is currently composed, so no remote outage strategy applies.

Rate limiting for password changes and public evaluation remains a deployment
gateway or proxy responsibility and is not duplicated in `iam`.
