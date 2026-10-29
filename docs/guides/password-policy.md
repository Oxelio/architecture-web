# Password policy

## Domain and application

`PasswordPolicy` expresses requirements independently of providers and storage. Its factory validates finite integer bounds, supported strengths, boolean switches and composition values, then freezes the policy and nested composition. `evaluatePasswordRules` evaluates pure rules; `selectPasswordPolicyProfile` maps the authoritative account role to the standard or privileged profile.

`PasswordPolicyReader.get(profile)` returns one coherent immutable policy. `FixedPasswordPolicyReader` supports isolated composition and tests. `PublishedIamPolicies` projects a complete published configuration revision. Consuming use cases read once and pass the policy to `PasswordValidation`, which coordinates strength, common-password and compromised-password ports without reading configuration.

Length is measured in Unicode code points. Passwords are not trimmed, normalized or truncated. The plaintext value object enforces representation safety rather than the current creation policy; existing passwords are not reevaluated at sign-in.

## Profiles and defaults

| Profile    | Default level | Minimum | Maximum | Minimum strength |
| ---------- | ------------- | ------: | ------: | ---------------- |
| standard   | elevated      |      15 |     128 | acceptable       |
| privileged | critical      |      20 |     128 | strong           |

The independent `standard` level preset has a minimum of 12 and `weak` strength. Custom levels use explicitly configured requirements. Composition is optional and disabled by default. Policy maximums accept at least 64 code points and remain compatible with the plaintext representation bound.

Sign-up, public policy consultation and public evaluation use the standard profile. Authenticated changes and recovery use the persisted role, never a client-supplied role. Recovery now applies the complete validation mechanism, including compromised/common checks and configured current-password rejection. It preserves suspension, verification and MFA state and does not create a session.

## Configuration and transport

The latest published PostgreSQL revision controls new operations. Startup initializes configuration explicitly; there is no implicit environment override or per-step reload. Administrative consumption and publication use different application contracts.

- `GET /v1/iam/password-policy` returns public standard requirements.
- `POST /v1/iam/password-policy/evaluate` returns validity, strength and stable error codes.
- Sign-up, password change and recovery reset require exact password confirmation.
- Authenticated changes additionally verify the current password before checking the replacement.

Expected password failures use `password.*` codes, including `password.compromised`, `password.too_common`, `password.too_weak`, `password.contextual` and `password.reused`. A checker outage is a technical failure; it does not silently allow a password or become a policy violation.

## Technical limits

Composition selects Argon2id and small replaceable local checking lists. Their presence is not a comprehensive compromise dataset. No remote checker or remote-outage fallback is composed. Password history and invitation/admin password-definition journeys remain absent. Rate limiting of public evaluation and authenticated change remains a deployment concern.

Persisted hash verification remains owned by the selected hashing adapter. This refactoring removes obsolete application contracts and forwarding APIs, rather than invalidating stored credentials.
