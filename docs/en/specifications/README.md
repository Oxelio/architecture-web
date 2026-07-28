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

| Identifier                          | Status      | Subject                                                |
| ----------------------------------- | ----------- | ------------------------------------------------------ |
| [SF-SESSION-001](SF-SESSION-001.md) | Implemented | Enrich active sessions with identification information |
