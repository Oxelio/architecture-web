# Project documentation

This directory is the canonical documentation for Architecture Web. Git is the
only documentation history: current files describe the current project, while
previous states remain available through commits and tags.

Repository documentation is maintained in **English only**. Conversations,
brainstorming, and exploration may happen in another language, but accepted
knowledge is integrated into the canonical English document instead of being
copied into parallel language trees.

## Start here

1. [Project vision](project/vision.md) — what the project is trying to prove;
2. [Architecture principles](project/architecture-principles.md) — durable
   design constraints;
3. [Project scope](project/scope.md) — what this repository currently covers;
4. [Delivery pipeline](project/delivery-pipeline.md) — how an idea becomes
   validated software;
5. [Architecture overview](architecture/overview.md) — current executable
   structure;
6. [Dependency rules](architecture/dependency-rules.md) — allowed and forbidden
   dependencies;
7. [Adding a feature](development/adding-a-feature.md) — contributor workflow.

## Project governance

- [Project governance index](project/README.md)
- [Documentation conventions](project/documentation-conventions.md)
- [Delivery pipeline and artifacts](project/delivery-pipeline.md)
- [Templates](project/templates/README.md)
- [AI context and workflow](ai/README.md)

## Architecture

- [Overview](architecture/overview.md)
- [Layers and boundaries](architecture/layers.md)
- [Dependency rules](architecture/dependency-rules.md)
- [Packages and public APIs](architecture/packages.md)
- [Security configuration redesign](architecture/security-configuration-redesign.md)
- [Architecture Decision Records](architecture/decisions/README.md)

## Functional documentation

- [Functional specifications](specifications/README.md)
- [Active explorations](explorations/README.md)
- [Authentication and sessions](guides/iam-sessions.md)
- [User administration](guides/iam-user-administration.md)
- [Password policy](guides/password-policy.md)
- [Account security, MFA, audit, and configuration](guides/account-security.md)
- [HTTP interface](reference/http-api.md)

## Development

- [Getting started](development/getting-started.md)
- [Development conventions](development/conventions.md)
- [Testing and verification](development/testing.md)
- [Adding a feature](development/adding-a-feature.md)

## Sources of truth

Each fact should have one identifiable owner. Documentation can summarize a
rule for local understanding, but should link to its owner rather than create a
second normative version.

Examples:

- product direction and delivery rules are owned by `docs/project`;
- current architectural rules are owned by `docs/architecture`;
- durable architecture decisions and their rationale are owned by ADRs;
- feature behavior is owned by the corresponding Functional Specification;
- package exports are defined by each package manifest and public index;
- executable HTTP schemas and routes remain authoritative for the implemented
  transport contract;
- executable tests provide evidence for implemented behavior.

Documentation explains and governs these sources; it does not invent current
implementation facts that are not demonstrated by the repository.
