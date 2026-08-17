# Software Engineering Method

> **Content status:** Canonical
>
> **Document type:** Engineering Method
>
> **Domain:** Delivery / AI-assisted engineering

## Purpose

This directory defines the generic software-engineering method adopted by
Architecture Web. The method governs how work is understood, classified,
specified, approved, designed, prepared, implemented, reviewed, validated, and
contextualized for humans and AI agents.

The method deliberately does **not** prescribe a product architecture, a
programming language, a framework, or Domain-Driven Design. Those choices belong
to each adopting project.

Architecture Web binds this method to its own canonical project sources through
the [Project Method Profile](../project/project-method-profile.md).

## Core documents

1. [Core model](core-model.md) — vocabulary, invariants, truth model, and method/project boundary.
2. [Work classification](work-classification.md) — Work Types, Change Characteristics, Quick/Standard/Complex, and artifact triggers.
3. [Lifecycle](lifecycle.md) — Work States, Activities, Gates, transitions, and route examples.
4. [Artifact ownership](artifact-ownership.md) — durable owners, working artifacts, evidence, and synchronization rules.
5. [AI role contracts](roles.md) — permissions, limits, escalations, and role transitions.
6. [Context Manifest](context-manifest.md) — progressive context resolution and authority-aware context selection.
7. [Readiness Review](readiness-review.md) — the gate that determines whether work may enter `Ready`.
8. [Working Decision Log](working-decision-log.md) — temporary workflow memory and decision-promotion rules.
9. [Review and validation](review-validation.md) — independent review perspectives and evidence-based validation.
10. [Project Method Profile](project-method-profile.md) — how an adopting project binds the method to canonical sources.

## Method boundary

The method owns **work governance**. An adopting project owns its product intent,
scope, architecture, technologies, conventions, concrete decisions,
implementation, and evidence.

When the method requires a project-specific choice, the method owns the
requirement that the choice be explicit; the project owns the chosen value.
For example, the method requires an identifiable owner for architecture
constraints. Architecture Web chooses DDD, Clean Architecture, Hexagonal
Architecture, and its concrete dependency rules in project-owned documents.

## Authority

Git is the canonical project and method history in this repository. AI
conversations, handoffs, Context Manifests, Working Decision Logs, and generated
proposals are working context only until accepted knowledge is integrated into
its authoritative owner.
