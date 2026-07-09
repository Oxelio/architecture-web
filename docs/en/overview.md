# Overview

## Project presentation

This project is a reference web application centered on identity and authentication. It illustrates a modular architecture where the core business logic is separated from external technical mechanisms such as databases, sessions, password hashing, and email delivery.

## Goals

The system was designed to demonstrate how to build a robust application by clearly separating:

- business logic,
- application use cases,
- the web API,
- and infrastructure adapters.

This separation keeps business rules at the center of the system while isolating external dependencies.

## Problems addressed

The project addresses several common architectural concerns:

- avoiding mixing business logic with infrastructure code,
- making use cases testable without depending on a web framework,
- allowing technical implementations to be replaced easily without changing the business core,
- clarifying responsibilities between HTTP transport and application logic.

## General philosophy

The central principle is that the domain should not depend on technical details. Use cases rely on abstractions rather than concrete implementations. This means business rules remain stable even if the database, cache system, or email library changes.

## Guiding principles

- Business logic belongs to the domain.
- Use cases orchestrate business actions clearly.
- Infrastructure is implemented through adapters.
- The API only transports requests and responses.
- Business errors are explicitly modeled.
- External dependencies are injected at the system entrypoint.

## Major decisions

The project favors a hexagonal-style approach with a dedicated bounded context for identity. This choice keeps the context autonomous while remaining composable.
