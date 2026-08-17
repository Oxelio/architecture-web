# ChatGPT workflow for Architecture Web

## Project boundary

Use the ChatGPT Project `Architecture Web` as the evolving project workspace.
The repository remains canonical; ChatGPT conversations are reasoning and
working context.

A future generic method-aware Custom GPT may own the reusable method behavior,
while this ChatGPT Project continues to provide Architecture Web-specific
context. Do not put Architecture Web product/architecture truth into the generic
method layer.

## Conversation boundary

Prefer one focused conversation per meaningful problem or workflow slice rather
than one indefinitely growing chat.

Example titles:

```text
[Identity][EXPLORE] Configurable user registration
[Identity][SPEC] User registration
[Identity][TECH] Registration policy design
[Identity][READY] Registration readiness
[Identity][TASK] Registration implementation
[Identity][REVIEW] Registration implementation
[Global][ARCH] Bounded-context communication
```

## Kickoff

For meaningful work, start from the generic method:

```text
Project: Architecture Web
Subject: <work>
Known Work Type: <if known>
Known current state/activity: <if known>
Goal: <what must be decided or produced>
Relevant sources already known:
- ...
```

Then resolve rather than assume:

1. Work Type;
2. Change Characteristics;
3. Workflow Depth;
4. applicable route / Activity;
5. Role;
6. Project Method Profile bindings;
7. Context Manifest;
8. gates/blockers.

## Context

Load context progressively. Prefer authoritative narrow sources and directly
relevant implementation evidence. Do not automatically load unrelated bounded
contexts, obsolete explorations, rejected designs, or all repository files.

When the role/activity changes materially, re-resolve context instead of simply
accumulating every prior source.

## Handoffs

Handoffs are temporary workflow context. They should identify:

- Work and current state/activity;
- source and destination roles;
- authoritative outputs by reference;
- active blockers/risks;
- unresolved Working Decisions;
- next allowed activity.

Do not copy entire Functional Specifications or Technical Designs into handoffs.

## Coding-agent handoff

Use a coding agent after the relevant work is Ready (or after the lightweight
Quick readiness check). Give it focused Tasks/work items and canonical source
references. Root [`AGENTS.md`](../../AGENTS.md) contains the repository-level
operational instructions.
