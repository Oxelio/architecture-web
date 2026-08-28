# Functional specifications

Functional Specifications are the canonical owners of approved product behavior
for an identified scope. Their generic ownership and approval semantics are
defined by the [Software Engineering Method](../../external/software-engineering-method/artifact-ownership.md).
Architecture Web-specific delivery bindings are in the
[Project Method Profile](../project/project-method-profile.md).

Use the [Functional Specification template](../project/templates/functional-specification.md)
for new substantial behavior.

## Artifact maturity and legacy metadata

Existing specifications predate the method's explicit separation between Work
State and artifact maturity. Their `Lifecycle` field is retained for compatibility
and should be read as **specification/work-scope maturity**, not as the generic
Work State.

Conservative legacy mappings already applied in this repository are:

- previous `Accepted` -> `Approved`;
- previous `Implemented` -> `Implementation`.

`Implementation` deliberately does **not** assert that the feature completed a
formal Architecture Review and Validation under the current method. A legacy
feature may move to `Done` only after implementation, owners, architecture, and
validation evidence are reviewed together.

## Catalog

| Identifier                                            | Lifecycle      | Subject                                                      |
| ----------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| [SF-ACCOUNT-DATA-001](SF-ACCOUNT-DATA-001.md)         | Approved       | Account data export and deletion                             |
| [SF-ACCOUNT-RECOVERY-001](SF-ACCOUNT-RECOVERY-001.md) | Approved       | Account recovery and password reset                          |
| [SF-ADMIN-USERS-001](SF-ADMIN-USERS-001.md)           | Implementation | Search and pagination for user administration                |
| [SF-MFA-001](SF-MFA-001.md)                           | Approved       | Multifactor authentication with an authenticator application |
| [SF-NOTIFICATIONS-001](SF-NOTIFICATIONS-001.md)       | Approved       | Notification center and multichannel delivery                |
| [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md)     | Approved       | Security event audit trail                                   |
| [SF-SECURITY-CONFIG-001](SF-SECURITY-CONFIG-001.md)   | Approved       | Dynamic security feature and policy configuration            |
| [SF-SESSION-001](SF-SESSION-001.md)                   | Implementation | Enrich active sessions with identification information       |
| [SF-PASSWORD-001](SF-PASSWORD-001.md)                 | Implementation | Configurable secure password policy                          |

## Observed implementation coverage

Several approved security specifications have executable foundations but do
not yet have enough evidence for every acceptance criterion to finish formal
implementation/validation under the current method.

`SF-NOTIFICATIONS-001` has an executable foundation: Domain Events, an outbox,
Audit and Notifications bounded contexts, a Web center, preferences, and email,
Slack, and SMS adapters. It remains `Approved` until the project explicitly
starts/accepts implementation against the complete specification and closes
remaining evidence gaps.

| Specification             | Current coverage                                            | Gaps or missing evidence                                                                                              |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `SF-ACCOUNT-DATA-001`     | ZIP export, download, deferred deletion, and cancellation   | no deployment scheduler in the repository; integration scenarios and legal-retention constraints are not demonstrated |
| `SF-ACCOUNT-RECOVERY-001` | request, single-use token, reset, and session revocation    | dynamic length policy differs from the shared validator; incomplete integration coverage                              |
| `SF-MFA-001`              | TOTP enrollment, backup codes, and sign-in challenge        | notifications and integration/concurrency scenarios are not demonstrated                                              |
| `SF-SECURITY-AUDIT-001`   | event writes, consultation, and purge                       | event completeness and transactional durability are not demonstrated                                                  |
| `SF-SECURITY-CONFIG-001`  | typed form, revisions, preview, restoration, and one policy | step-up authentication and multi-instance propagation unproven; email verification has no consumer                    |

The [Account security](../guides/account-security.md) guide links these findings
to executable sources and details known limitations.
