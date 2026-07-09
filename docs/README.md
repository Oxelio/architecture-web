# Documentation

This repository contains a modular architecture sample focused on identity management. The documentation is organized in two parallel language editions so that both humans and AI agents can understand the intent of the system quickly.

## Structure

- [fr](fr/README.md) — documentation française
- [en](en/README.md) — English documentation

## What this project demonstrates

This repository is an example of a layered, modular architecture that separates:

- the web API entrypoint,
- the application use cases,
- the domain model,
- infrastructure adapters,
- and cross-cutting concerns such as persistence, sessions, hashing, and email delivery.

The main goal is not only to implement identity features, but to show how to keep business rules inside the domain while isolating external systems behind ports and adapters.

## Audit summary of the previous documentation

The earlier documents were mostly useful as high-level sketches, but they were too narrow and too generic to serve as a durable reference for contributors or AI agents. The main decisions were:

- keep the general overview and architectural explanation, but rewrite them around the actual repository structure;
- merge the scattered architectural notes into a single coherent documentation flow;
- replace isolated examples with guidance focused on intent, constraints, and conventions;
- remove documents that were too generic or redundant for the current repository state.

## Documentation principles

The documentation in this repository is written to explain:

- why the system is structured in that way,
- which architectural boundaries matter,
- which conventions should be preserved,
- and how to extend the system safely.
