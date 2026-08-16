# ChatGPT workflow for Architecture Web

## Project boundary

Use one ChatGPT Project named `Architecture Web` for this product rather than a
separate Project for every package, repository, or bounded context.

The ChatGPT Project boundary follows the long-lived product/context boundary.
Create another ChatGPT Project only when the work has a genuinely different
product context, vocabulary, goals, and source material.

## Conversation boundary

Prefer one conversation per focused problem. Example titles:

```text
[Identity][EXPLORE] Configurable user registration
[Identity][SPEC] User registration
[Identity][TECH] Registration policy architecture
[Identity][TASK] Registration implementation
[Identity][REVIEW] Registration implementation
[Global][ADR] Bounded-context communication
```

Avoid a single indefinitely growing chat that mixes unrelated architecture,
release, feature, and review questions.

## Context model

The repository is the source of truth. ChatGPT is a reasoning and drafting
workspace, not the canonical project memory.

A useful flow is:

```text
Git documentation / code
        ↓
focused ChatGPT conversation
        ↓
exploration / decision / review
        ↓
canonical repository update
        ↓
implementation task
        ↓
coding agent / developer
        ↓
review and validation
        ↓
Git
```

## Conversation kickoff

Provide only the local context that is not already captured by project
instructions or canonical documentation:

```text
Bounded context: <name>
Subject: <problem or feature>
Current lifecycle: <Idea | Exploration | Design | ...>
Relevant canonical documents:
- <link>
- <link>

Goal for this conversation:
<what must be decided or produced>

Known requirements / constraints:
- ...

Do not invent missing business requirements. Separate functional decisions
from technical implementation and identify assumptions explicitly.
```

## Role separation

Use conversational ChatGPT primarily for discovery, modeling, architecture
reasoning, specification, ADR discussion, task preparation, and review.

Use a coding agent when the work requires repository inspection,
implementation, refactoring, running commands, and tests. Give the agent a
small task that references canonical documents rather than pasting a second
copy of the entire design.
