# ChatGPT workflow for Architecture Web

## Project boundary

Use the ChatGPT Project `Architecture Web` as the evolving project workspace.
The repository remains canonical for repository-owned truth; ChatGPT
conversations are reasoning and working context.

Architecture Web defines target operational Work/Task mappings to GitHub through
the project [Delivery profile](../project/delivery-pipeline.md). A mapped GitHub
owner becomes effective only after that mapping is activated under the delivery
policy. Until activation, treat the operational owner as unavailable rather than
creating a substitute source of truth. GitHub is not a universal source of truth:
resolve each subject through the Project Method Profile and the owner responsible
for it.

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

For meaningful work, first resolve the operational Work record when its mapping
is effectively activated and the owner is available, then apply the generic
method:

```text
Project: Architecture Web
Work Issue: <activated GitHub Work Issue when known/available>
Subject: <work>
Known Work Type: <if known>
Known Work State: <read from activated GitHub Project owner when available>
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
8. gates/blockers;
9. operational permissions and external-owner activation needed for any GitHub
   mutation.

When the GitHub Project mapping is effectively activated, do not infer Work State
from chat history if the activated owner cannot be read; surface the
synchronization limitation instead. If the mapping is not yet activated, surface
that the operational owner is unavailable rather than treating any substitute as
canonical.

## Orchestration

ChatGPT may coordinate the workflow across Roles when the active toolset and
project policy permit it. Orchestration means:

```text
inspect current Work
-> resolve Activity and Role
-> load focused authoritative context
-> perform only Role-authorized reasoning/mutations
-> verify transition gates
-> update permitted operational state when its owner is activated
-> re-resolve Role/context when activity changes materially
```

Technical capability is not authority. A GitHub token that can modify an Issue,
Project, branch, or PR does not authorize ChatGPT to make the decision represented
by that mutation.

Follow the operational permission matrix and external-owner activation rules in
the project [Delivery profile](../project/delivery-pipeline.md). Never cross a
human-only gate automatically.

## Work and Task records

Use a top-level GitHub Issue as the operational Work identity only when that
mapping is effectively activated and available. Keep its body lightweight and
reference canonical owners rather than copying specifications or designs into it.

When Task Planning is triggered, represent Tasks as GitHub Sub-issues only when
the Task/Sub-issue mapping is effectively activated and available. Do not create
artificial Sub-issues for Quick work or create a parallel substitute owner when
the mapping is unavailable.

## Context

Load context progressively. Prefer authoritative narrow sources and directly
relevant implementation evidence. Do not automatically load unrelated bounded
contexts, obsolete explorations, rejected designs, or all repository files.

When the role/activity changes materially, re-resolve context instead of simply
accumulating every prior source.

## Lifecycle mutations

Before changing `Work State`, verify that the Work State owner is effectively
activated and available, then verify the transition rule in the Method and any
applicable authority/readiness/quality/evidence gate.

In particular:

- do not move `Preparing -> Ready` without a valid Readiness result;
- do not interpret a merged PR as `Done`;
- do not close a Work as completed until Done invariants are verified;
- use Issue closure disposition rather than `Done` for abandoned/not-planned
  Work;
- do not maintain GitHub native `Status` as a parallel lifecycle.

## Handoffs

Handoffs are temporary workflow context. They should identify:

- Work and current state/activity;
- source and destination roles;
- authoritative outputs by reference;
- active blockers/risks;
- unresolved Working Decisions;
- next allowed activity.

Do not copy entire Functional Specifications or Technical Designs into handoffs.
When the Work Issue mapping is effectively activated and available, reference the
Work Issue rather than making the handoff an alternative operational owner.

## Coding-agent handoff

Use a coding agent after the relevant work is Ready (or after the lightweight
Quick readiness check). Give it focused authorized Task/work units and canonical
source references; use Task Sub-issues when that mapping is effectively
activated and available. Root [`AGENTS.md`](../../AGENTS.md) contains the
repository-level operational instructions.
