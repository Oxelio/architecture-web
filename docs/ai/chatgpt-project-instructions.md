# Suggested ChatGPT Project instructions

The following is the **Architecture Web project layer** for ChatGPT. Generic
workflow behavior should come from the repository's
[Software Engineering Method](../../external/software-engineering-method/README.md), not be
duplicated here.

```text
You are working on the Architecture Web reference project.

Git and the canonical repository documentation are the source of truth for the
subjects they own. Use the pinned Software Engineering Method in
  external/software-engineering-method/ for work governance and resolve
Architecture Web-specific owners through
  docs/project/project-method-profile.md.
Treat the submodule gitlink recorded by Architecture Web as the adopted Method
revision. Do not infer software-engineering-method/main or any other floating
reference as implicitly adopted.

Architecture Web defines GitHub Issues/Projects as target operational owners for
Work, Tasks, Work State, and delivery ordering according to
  docs/project/delivery-pipeline.md.
A GitHub mapping becomes an operational owner only after it is effectively
activated under that policy. Until activation, treat the mapped owner as
unavailable rather than inferring a substitute value or parallel owner.
GitHub is not a universal source of truth. Do not copy product behavior,
architecture, governance, or validation truth into Issues as competing owners.

At the beginning of meaningful work:
1. resolve the owning GitHub Work Issue only when its mapping is effectively
   activated and the Issue owner is available;
2. read the current Work State from its activated operational owner when
   available;
3. identify the primary Work Type;
4. identify relevant Change Characteristics;
5. classify Workflow Depth as Quick, Standard, or Complex;
6. derive the applicable route and current Activity;
7. select the appropriate active Role;
8. build or refresh a focused Context Manifest;
9. verify applicable human gates and owner documents before making normative
   decisions;
10. verify Tool Capability, Operational Permission, and external-owner activation
    before any required GitHub mutation.

Tool Capability, Operational Permission, and Role Authority are independent.
Repository/API permissions, in or the ability to mutate an Issue,
Project, branch, or Pull Request do not authorize decisions outside the active
Role or bypass project gates.

## Behavior and architecture

- Do not invent new product behavior. Use an approved Functional Specification
  when product behavior is in scope.
- Do not silently turn an implementation limitation into a domain or product
  rule.
- Preserve Architecture Web's project-owned architecture rules. Don't
  generalize those rules into the Software Engineering Method.
- Route functional, architectural, governance, and task blockers to the
  authority able to resolve them.

## Context

- For meaningful work, use a proportional Context Manifest.
- Load only the context needed by the current Activity and Role.
- Re-resolve context when the Activity or Role changes materially.
- Prefer the authoritative owner over a resolved Working Decision or handoff
  summary.

## Gates and mutations

- Never claim to have executed a human-only gate.
- Before a GitHub mutation, check Tool Capability, Operational Permission,
  active Role Authority, and applicable Gates independently.
- A mergeable Pull Request does not imply governance acceptance, functional
  approval, validation acceptance, or `Done`.

## Validation

- Use `docs/development/testing.md` for Architecture Web-validation policy.
- Select the smallest sufficient evidence set for the changed behavior,
  boundaries, and risks.
- Validation evidence is evidence, not an owner of product or architecture
  truth.
