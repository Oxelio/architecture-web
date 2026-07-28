# Configurable Secure Password Policy

> **Identifiant :** SF-PASSWORD-001
>
> **Statut :** Implemented
>
> **Technical documentation:** [Password policy](../guides/password-policy.md)

## Context

The application currently allows a user account to be created with a password and allows an authenticated user to change their password.

The password requirements are currently absent, insufficient, or not formally defined.

This creates several risks:

- users may choose passwords that are too short or easy to guess;
- passwords may already be present in known data breaches;
- password-validation rules may differ between account creation and password changes;
- a typing mistake may result in an unintended password being registered;
- the application may rely on outdated composition rules without providing meaningful security.

A consistent password policy must therefore be introduced for every operation that defines a new password.

## Functional Objective

Implement a configurable password-security policy that:

1. enforces an appropriate level of password robustness;
2. applies consistently during account creation and password changes;
3. rejects passwords known to be weak, common, or compromised;
4. allows the required security level to be configured;
5. confirms that the password entered by the user is the intended password;
6. provides understandable validation feedback without exposing sensitive security information;
7. follows current cybersecurity recommendations from recognized authorities such as NIST, ANSSI, and OWASP.

## Security Principles

The policy must follow these principles:

- password length is the primary security requirement;
- long passphrases must be supported;
- arbitrary mandatory composition rules must not be the primary security mechanism;
- all normal character categories must be accepted;
- passwords must not be silently truncated;
- commonly used or compromised passwords must be rejected;
- the same password policy must apply to account creation and password changes;
- password validation must be implemented in the application backend and must not rely only on client-side validation;
- the security policy must be configurable without modifying the business logic.

The implementation must not assume that requiring one uppercase letter, one lowercase letter, one number, and one special character automatically produces a strong password.

Such requirements may be supported as an optional compatibility policy, but they must not be the recommended default.

## Supported Operations

The password policy must apply whenever a new user password is defined, including at least:

- account registration;
- authenticated password change;
- password reset, if such a flow already exists;
- password definition by an administrator, if the application supports this operation;
- password definition during account activation or invitation, if applicable.

All these operations must rely on the same central password-policy mechanism.

## Configurable Security Levels

The application must support configurable password-security levels.

At minimum, the following levels should be representable.

### Standard Level

Intended for accounts protected by an additional authentication factor or for applications with a moderate risk level.

Recommended default characteristics:

- minimum length: 12 characters;
- recommended length: at least 15 characters;
- maximum accepted length: at least 64 characters;
- common and compromised passwords rejected;
- all supported characters allowed;
- no mandatory character-category rule by default.

### High Level

Intended for accounts using password-only authentication or containing sensitive personal or business data.

Recommended default characteristics:

- minimum length: 15 characters;
- maximum accepted length: at least 64 characters;
- common and compromised passwords rejected;
- context-specific passwords rejected when relevant;
- all supported characters allowed;
- long passphrases encouraged;
- password-strength feedback enabled.

### Critical Level

Intended for administrators, privileged accounts, infrastructure operators, or accounts with access to highly sensitive operations.

Recommended default characteristics:

- minimum length: configurable, with a recommended default of 20 characters;
- maximum accepted length: at least 64 characters;
- common and compromised passwords rejected;
- contextual and predictable passwords rejected;
- stronger password-strength threshold;
- multifactor authentication expected or required by a separate policy;
- optional prevention of recent password reuse when password history is supported.

These levels are initial functional defaults. The agent must determine how they should be represented technically according to the existing configuration architecture.

## Custom Policy

The application must also allow a custom password policy to be configured.

The configurable properties should include, where relevant:

- minimum password length;
- maximum accepted password length;
- minimum required strength score;
- compromised-password verification enabled or disabled;
- common-password verification enabled or disabled;
- contextual-password verification enabled or disabled;
- optional uppercase-letter requirement;
- optional lowercase-letter requirement;
- optional numeric-character requirement;
- optional special-character requirement;
- optional repeated-character restrictions;
- optional sequential-character restrictions;
- optional password-history length;
- policy applied to normal users;
- policy applied to privileged or administrator accounts.

The implementation must provide secure defaults.

Disabling an important security control must require an explicit configuration choice rather than occurring implicitly.

## Default Recommended Policy

Unless the project already defines a stricter requirement, the default policy should be:

- minimum of 15 Unicode characters;
- maximum accepted length of at least 64 characters;
- no mandatory uppercase, lowercase, numeric, or special-character category;
- spaces accepted;
- Unicode characters accepted;
- long passphrases accepted;
- no silent trimming or truncation;
- rejection of commonly used passwords;
- rejection of known compromised passwords;
- rejection of a password containing obvious account-specific information when this can be checked reliably;
- password-strength feedback available to the client;
- identical server-side validation for registration and password changes.

The maximum length may be greater than 64 characters if the existing password-hashing infrastructure supports it safely.

## Password Confirmation

Every user interface or public input contract used to define a password must include:

- `password`;
- `passwordConfirmation`.

This requirement applies at least to:

- account creation;
- authenticated password changes;
- password resets;
- password definition following an invitation or account activation.

The operation must fail when the two values differ.

The password-confirmation value:

- exists only to detect typing mistakes;
- must not be persisted;
- must not be hashed;
- must not be logged;
- must not be transmitted to unrelated domain or persistence components;
- must be discarded after the equality check.

The password and confirmation must be compared exactly, without automatic normalization that could cause a different password to be accepted.

## Account-Creation Behaviour

When creating an account, the user must provide:

- their password;
- confirmation of that password.

The account must not be created when:

- the password and confirmation differ;
- the password does not satisfy the active policy;
- the password is identified as commonly used;
- the password is identified as compromised;
- the configured strength threshold is not met;
- another existing account-creation validation fails.

Password validation must occur before the password is persisted.

A failure must not create a partial user account unless the existing architecture intentionally supports a recoverable registration workflow.

## Password-Change Behaviour

When an authenticated user changes their password, the user must provide:

- the current password, unless another previously authorized security flow replaces this verification;
- the new password;
- confirmation of the new password.

The operation must fail when:

- the current password is invalid;
- the new password and its confirmation differ;
- the new password does not satisfy the active policy;
- the new password is the same as the current password, when this restriction is enabled;
- the new password appears in the configured password history;
- the compromised-password check rejects it.

The new password must not replace the current password until every validation has succeeded.

The agent must preserve the existing transactional behaviour of the password-change use case.

## Strength Evaluation

The application must be able to evaluate the probable strength of a proposed password.

The evaluation may consider:

- length;
- use of a passphrase;
- predictable sequences;
- repeated characters;
- keyboard patterns;
- common substitutions;
- common words;
- known password patterns;
- account-specific context;
- presence in known compromised-password lists.

The resulting evaluation should be expressible through a stable functional representation, for example:

- too weak;
- weak;
- acceptable;
- strong;
- very strong.

A numerical score may be used internally, but public contracts should not depend unnecessarily on the scoring model of a specific library.

The domain or application layer must not depend directly on a particular password-strength library.

## Common and Compromised Passwords

Passwords known to be commonly used or compromised must be rejected when the corresponding control is enabled.

The implementation must support one or more of the following mechanisms:

- a locally maintained denylist;
- a packaged or regularly updated common-password dataset;
- a remote compromised-password verification service;
- an internal security service exposed through an application port.

The application core must not depend directly on a specific external provider.

A compromised-password check must avoid sending the user's complete plaintext password to an external service.

The agent must use a privacy-preserving mechanism supported by the selected provider, or perform the verification locally.

The raw password must never be:

- logged;
- included in monitoring events;
- stored temporarily in a database;
- sent through an event bus;
- included in an error;
- returned in an API response.

## Contextual Password Rejection

When enabled, the system should reject or penalize passwords that contain obvious user-specific information, such as:

- email address;
- username;
- display name;
- first name;
- last name;
- application name;
- organization name.

This check must remain proportionate.

It must not collect additional personal information solely for password analysis.

It must also avoid excessive false positives, particularly for short names or common words.

## Validation Feedback

The user must receive useful feedback when the password is rejected.

Possible functional error reasons include:

- password confirmation does not match;
- password is too short;
- password is too long;
- password is too common;
- password has appeared in known data breaches;
- password is too predictable;
- password does not meet the required strength level;
- password does not satisfy a custom configured requirement;
- password matches a recently used password;
- current password is incorrect.

The API must return stable business error codes rather than library-specific messages.

Examples of possible error codes:

```text
password.confirmation_mismatch
password.too_short
password.too_long
password.too_common
password.compromised
password.too_weak
password.contextual
password.reused
password.current_invalid
```

The exact naming must follow the project's existing success- and error-code conventions.

The validation response must not reveal:

- the stored password;
- the password hash;
- the exact contents of the compromised-password dataset;
- internal hashing parameters;
- unnecessary information about another account.

## User Experience Requirements

The client must be able to display the active password requirements before submission.

The application contract should expose or make available the relevant public policy information, such as:

- minimum length;
- maximum length;
- security level;
- whether a compromised-password check is enabled;
- optional mandatory composition requirements;
- required strength category.

The client may provide live password-strength feedback.

However:

- server-side validation remains authoritative;
- the account must not be created based only on client-side validation;
- the password-change operation must not succeed based only on client-side validation;
- the strength indicator must not claim that a password is guaranteed to be secure.

The user should be encouraged to use:

- a long and unique password;
- a passphrase;
- a password manager.

## Character Handling

The implementation must:

- support spaces;
- support Unicode characters when compatible with the current platform;
- define clearly whether Unicode normalization is performed;
- avoid silently removing leading or trailing spaces;
- avoid silently truncating the password;
- ensure that registration and authentication perform exactly the same character handling;
- ensure that the accepted password length is compatible with the hashing implementation.

Length must be defined consistently.

The agent must explicitly determine whether the project measures:

- Unicode code points;
- grapheme clusters;
- encoded bytes.

The chosen rule must be documented and used consistently throughout password creation, validation, hashing, and authentication.

## Password Storage

This task must preserve or improve secure password storage.

Passwords must:

- be processed through the existing password-hashing port or equivalent abstraction;
- never be stored in plaintext;
- never be stored using reversible encryption;
- use a password-hashing algorithm suitable for password storage;
- use unique salts as required by the selected hashing mechanism;
- use configuration parameters appropriate to the deployment environment.

The application core must remain independent of a particular hashing implementation.

If Argon2id, bcrypt, scrypt, or another implementation is already available through an infrastructure adapter, the agent must verify that:

- it supports the configured maximum input length;
- it does not silently truncate the password;
- its work factors are appropriate;
- verification remains compatible with existing password hashes.

This specification does not require replacing the existing hashing algorithm unless it is insecure or incompatible with the new requirements.

## Configuration and Architecture

The password policy must be represented as an application-level or domain-level concept independent from:

- HTTP;
- environment-variable libraries;
- configuration frameworks;
- password-strength libraries;
- compromised-password providers;
- hashing libraries.

Infrastructure configuration may construct the active password policy.

The agent must analyse the project to determine the most coherent placement for:

- password policy;
- password validator;
- password-strength evaluator;
- compromised-password checker;
- common-password checker;
- password-history checker;
- password hasher.

The implementation must avoid duplicating validation rules between:

- account creation;
- password changes;
- password resets;
- administrative password operations.

## Existing Passwords

Introducing the new policy must not invalidate existing passwords automatically.

Existing users must remain able to authenticate with their current password.

The new policy applies when:

- a new account is created;
- an existing password is changed;
- an existing password is reset;
- the application explicitly requires a password renewal.

A separate migration or forced-password-renewal policy may be introduced later if required.

## Failure of External Security Services

If compromised-password verification depends on an external service, the failure behaviour must be configurable.

Possible policies include:

- fail closed: reject password creation while verification is unavailable;
- fail open with security logging: allow the operation but record that verification could not be completed;
- fallback to a local denylist.

The secure default must be chosen according to the application's risk level.

The password itself must never appear in the error or security log.

## Audit and Logging

The application may record security events such as:

- password changed successfully;
- password reset successfully;
- password rejected because it was compromised;
- compromised-password service unavailable;
- repeated failed attempts to change a password.

Audit events must contain only necessary metadata.

They must never contain:

- plaintext passwords;
- password confirmations;
- password hashes;
- fragments of the password;
- values that allow the password to be reconstructed.

## Rate Limiting

The agent must verify that password-sensitive operations are protected against abuse.

This includes, where applicable:

- password-change attempts;
- current-password verification;
- password-reset attempts;
- external compromised-password queries.

If rate limiting belongs to another module, the agent must document the dependency rather than duplicating the mechanism.

## Functional Model

The implementation should support concepts equivalent to:

```text
PasswordPolicy
- security level
- minimum length
- maximum length
- minimum strength
- compromised-password check
- common-password check
- contextual-password check
- optional composition requirements
- optional history policy
```

```text
PasswordValidationResult
- valid or invalid
- strength category
- business validation errors
```

```text
DefinePasswordInput
- password
- password confirmation
```

The exact technical model must follow the existing architecture and naming conventions.

## Requested Work

1. Analyse all existing flows that define or replace a password.
2. Identify the current password value object, hashing port, infrastructure implementations, contracts, use cases, and error codes.
3. Define a central and configurable password-policy model.
4. Provide secure default security levels.
5. Apply the policy to account creation.
6. Apply the same policy to authenticated password changes.
7. Apply the policy to password-reset and invitation flows when they already exist.
8. Add password-confirmation fields to the relevant input contracts.
9. Reject an operation when the password and confirmation differ.
10. Add common-password and compromised-password checks behind suitable abstractions.
11. Add a password-strength evaluation mechanism without coupling the application core to a specific library.
12. Expose the public password requirements needed by clients.
13. Preserve compatibility with existing password hashes and existing user accounts.
14. Add stable success and error codes according to project conventions.
15. Add unit, integration, contract, and security-related tests.
16. Update the module documentation.
17. Document configuration options, defaults, security decisions, and infrastructure dependencies.
18. Report any public-contract breaking changes.

## Acceptance Criteria

The task is complete when:

- account creation requires a password and password confirmation;
- password change requires a new password and confirmation;
- password reset requires confirmation when that flow exists;
- mismatched values are rejected;
- the confirmation value is never persisted or logged;
- the same central policy is applied to every password-definition flow;
- the active password-security level can be configured;
- secure default levels are provided;
- the default policy requires at least 15 characters;
- at least 64 characters are accepted;
- long passphrases are accepted;
- spaces and supported Unicode characters are accepted;
- passwords are never silently truncated;
- common passwords can be rejected;
- known compromised passwords can be rejected;
- password strength can be evaluated and communicated through a stable application contract;
- composition requirements are optional rather than the default security mechanism;
- client-side feedback is possible, but backend validation remains authoritative;
- existing passwords remain valid until changed or reset;
- password values, confirmations, and hashes never appear in logs or errors;
- registration and password-change behaviours are covered by tests;
- configuration options and security choices are documented.

## Test Scenarios

Tests must cover at least:

1. account creation with matching valid password values;
2. account creation with mismatched confirmation;
3. account creation with a password below the minimum length;
4. account creation with a long passphrase;
5. account creation with spaces;
6. account creation with supported Unicode characters;
7. rejection of a common password;
8. rejection of a compromised password;
9. behaviour when compromised-password verification is unavailable;
10. password change with a valid current password;
11. password change with an invalid current password;
12. password change with mismatched confirmation;
13. password change with a weak new password;
14. password change using the configured high-security policy;
15. password change using a custom policy;
16. acceptance of the configured maximum length;
17. rejection above the configured maximum length;
18. verification that no password or confirmation is persisted in plaintext;
19. verification that no password appears in logs;
20. authentication with an existing password created before the new policy;
21. consistent validation between registration and password change;
22. privileged-account policy stricter than the normal-user policy, when configured.

## Out of Scope

Unless already required by the architecture, this task does not include:

- implementing multifactor authentication;
- forcing every existing user to change their password;
- building a complete password-reset workflow when none exists;
- developing the complete graphical user interface;
- implementing a password manager;
- automatically rotating user passwords periodically;
- sending password-expiration reminders;
- replacing the current password-hashing implementation without a demonstrated need.

The objective is to establish a centralized, configurable, modern, and consistently enforced password policy for every operation that defines a user password.
