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

All variables are listed in `apps/api/.env.example`: user and privileged policy
levels, minimum and maximum lengths, minimum strength,
common/compromised/context checks, current password reuse, and the four
optional composition rules. Disabling a security check therefore requires an
explicit `false`.

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

There are no reset, invitation, activation-with-password, or administrative
password-definition flows. Any future flow must reuse
`PasswordPolicyValidator`.

Password history is not represented in persistence; only reuse of the current
password is rejected. Embedded local lists are a minimal fallback. Sensitive
deployments should inject a maintained dataset or privacy-preserving service.
No remote service is currently composed, so no remote outage strategy applies.

Rate limiting for password changes and public evaluation remains a deployment
gateway or proxy responsibility and is not duplicated in `iam`.
