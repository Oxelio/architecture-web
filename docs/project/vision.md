# Architecture Web — Project vision

> **Lifecycle:** Approved
>
> **Content status:** Canonical
>
> **Document type:** Product Vision
>
> **Domain:** Project Direction

## Purpose

Architecture Web is a reference application used to design and demonstrate a
maintainable web architecture around identity and access management.

The project is not primarily an exercise in accumulating framework features.
Its value comes from making business rules, application contracts,
architectural boundaries, infrastructure choices, and delivery decisions
explicit enough to be understood, tested, changed, and reviewed independently.

## Core promise

A business capability should remain understandable and testable without
requiring knowledge of its HTTP framework, database, cache, email provider, UI
framework, or other replaceable infrastructure.

The architecture should make incorrect dependency direction and accidental
coupling visible rather than hiding them behind convenience abstractions.

## Desired properties

Architecture Web aims to demonstrate software that is:

- organized around business capabilities and bounded contexts;
- explicit about domain invariants and application orchestration;
- independent from infrastructure in domain and application layers;
- replaceable at technical boundaries through ports and adapters;
- testable at the closest useful level;
- maintainable without speculative abstraction;
- documented from intent to implementation;
- able to evolve through explicit architectural decisions rather than silent
  convention drift.

## What the vision does not require

The project does not require:

- a framework abstraction for every dependency;
- a port for every class or function;
- one repository per entity;
- a generic solution where a bounded-context-specific concept is clearer;
- every feature to traverse the full delivery pipeline;
- every local implementation choice to become an ADR;
- duplicate documentation in several languages.

## Relationship to current implementation

The repository contains both preferred architecture and historical exceptions.
The vision describes the target direction. Current deviations are documented
where they exist and are not silently reclassified as approved patterns.
