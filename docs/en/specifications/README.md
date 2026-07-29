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
