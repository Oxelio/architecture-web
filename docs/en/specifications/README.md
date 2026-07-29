# Functional specifications

Functional specifications describe expected behavior from a business and user
perspective. They define the need, actors, rules, edge cases, and acceptance
criteria without replacing architecture documentation or executable tests.

## Lifecycle

Each specification uses one of these statuses:

- **Draft**: under discussion and not yet accepted;
- **Accepted**: approved but not necessarily implemented;
- **Implemented**: reflected by the current application;
- **Superseded**: replaced by another named specification.

A status change **MUST** be supported by current project evidence. Technical
implementation details belong in architecture documentation and should be
linked rather than duplicated.

## Catalog

| Identifier                                            | Status      | Subject                                                      |
| ----------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| [SF-ACCOUNT-DATA-001](SF-ACCOUNT-DATA-001.md)         | Accepted    | Account data export and deletion                             |
| [SF-ACCOUNT-RECOVERY-001](SF-ACCOUNT-RECOVERY-001.md) | Accepted    | Account recovery and password reset                          |
| [SF-ADMIN-USERS-001](SF-ADMIN-USERS-001.md)           | Implemented | Search and pagination for user administration                |
| [SF-MFA-001](SF-MFA-001.md)                           | Accepted    | Multifactor authentication with an authenticator application |
| [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md)     | Accepted    | Security event audit trail                                   |
| [SF-SECURITY-CONFIG-001](SF-SECURITY-CONFIG-001.md)   | Accepted    | Dynamic security feature and policy configuration            |
| [SF-SESSION-001](SF-SESSION-001.md)                   | Implemented | Enrich active sessions with identification information       |
| [SF-PASSWORD-001](SF-PASSWORD-001.md)                 | Implemented | Configurable secure password policy                          |

## Observed coverage

The five accepted security specifications now have an executable foundation,
but not enough evidence for every acceptance criterion to move them to
“Implemented”:

| Specification             | Current coverage                                            | Gaps or missing evidence                                                                                              |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `SF-ACCOUNT-DATA-001`     | ZIP export, download, deferred deletion, and cancellation   | no deployment scheduler in the repository; integration scenarios and legal-retention constraints are not demonstrated |
| `SF-ACCOUNT-RECOVERY-001` | request, single-use token, reset, and session revocation    | dynamic length policy differs from the shared validator; incomplete integration coverage                              |
| `SF-MFA-001`              | TOTP enrollment, backup codes, and sign-in challenge        | notifications and integration/concurrency scenarios are not demonstrated                                              |
| `SF-SECURITY-AUDIT-001`   | event writes, consultation, and purge                       | event completeness and transactional durability are not demonstrated                                                  |
| `SF-SECURITY-CONFIG-001`  | typed form, revisions, preview, restoration, and one policy | step-up authentication and multi-instance propagation unproven; email verification has no consumer                    |

The [Account security](../guides/account-security.md) guide links these findings
to executable sources and details known limitations.
