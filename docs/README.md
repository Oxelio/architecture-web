# Project documentation

This directory contains the canonical project-owned documentation for Architecture
Web. The generic Software Engineering Method adopted by the project is owned by
the separate [software-engineering-method repository](https://github.com/Oxelio/software-engineering-method).
Git is the history; current project files describe current project owners and
accepted targets.

Repository documentation is maintained in **English only**. Conversations,
brainstorming, and Exploration may happen in another language, but accepted
knowledge is integrated once into its canonical owner.

## Start here

### Generic method

The canonical method is maintained externally in
[Oxelio/software-engineering-method](https://github.com/Oxelio/software-engineering-method).
Architecture Web does not maintain a normative copy under `docs/`.

### Architecture Web

1. [Project vision](project/vision.md)
2. [Project scope](project/scope.md)
3. [Project Method Profile](project/project-method-profile.md)
4. [Architecture principles](project/architecture-principles.md)
5. [Architecture overview](architecture/overview.md)
6. [Dependency rules](architecture/dependency-rules.md)
7. [Adding a feature](development/adding-a-feature.md)

## Project governance

- [Project governance index](project/README.md)
- [Project Method Profile](project/project-method-profile.md)
- [Documentation conventions](project/documentation-conventions.md)
- [Architecture Web delivery profile](project/delivery-pipeline.md)
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
- [Agent instructions](../AGENTS.md)

## Sources of truth

The generic ownership rules are defined by the canonical
[Software Engineering Method](https://github.com/Oxelio/software-engineering-method).
Architecture Web binds those semantic owners to concrete project files in the
[Project Method Profile](project/project-method-profile.md).

Documentation or implementation evidence may expose conflicts. Do not silently
resolve them by choosing the most recent or most convenient source; identify the
subject and route the conflict to its authoritative owner.
