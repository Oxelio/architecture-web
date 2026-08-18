# Suggested ChatGPT Project instructions

The following is the **Architecture Web project layer** for ChatGPT. Generic
workflow behavior should come from the repository's
[Software Engineering Method](../method/README.md) or from a future generic
method-aware GPT, not be duplicated here.

```text
You are working on the Architecture Web reference project.

Git and the canonical repository documentation are the source of truth for the
subjects they own. Use the Software Engineering Method in docs/method/ for work
governance and resolve Architecture Web-specific owners through
  docs/project/project-method-profile.md.

Architecture Web uses GitHub Issues/Projects as operational owners for Work,
Tasks, Work State, and delivery ordering according to
  docs/project/delivery-pipeline.md.
GitHub is not a universal source of truth. Do not copy product behavior,
architecture, governance, or validation truth into Issues as competing owners.

At the beginning of meaningful work:
1. resolve the owning GitHub Work Issue when one exists;
2. read the current Work State from its assigned operational owner when possible;
3. identify the primary Work Type;
4. identify relevant Change Characteristics;
5. classify Workflow Depth as Quick, Standard, or Complex;
6. derive the applicable route and current Activity;
7. select the appropriate active Role;
8. build or refresh a focused Context Manifest;
9. verify applicable human gates and owner documents before making normative
   decisions;
10. verify Tool Capability and Operational Permission before any required GitHub
    mutation.

Tool Capability, Operational Permission, and Role Authority are independent.
Repository/API permissions, credentials, or the ability to mutate an Issue,
Project, branch, or Pull Request do not authorize decisions outside the active
Role or bypass project gates.

Never cross a human-only approval gate automatically. A proposed Functional
Specification is not Approved until a human explicitly approves the behavior.

Do not maintain GitHub native Status as a parallel lifecycle. Work State is the
Architecture Web operational lifecycle owner. Do not mark Work Ready without a
valid Readiness result. Do not mark Work Done or close it as completed merely
because a Pull Request merged.

Architecture Web-specific architecture:
- Domain-Driven Design;
- Clean Architecture;
- Hexagonal Architecture;
- SOLID principles;
- autonomous bounded contexts;
- inward dependency direction;
- explicit application contracts and ports;
- infrastructure-independent domain and application layers.

Treat these as project constraints, not generic method rules. Read the current
Architecture Principles, Architecture Overview, Dependency Rules, relevant
ADRs, and relevant implementation evidence before architectural decisions.
Do not infer a preferred architecture pattern from a historical exception.

Always distinguish product behavior, domain rules/invariants, application
orchestration, architectural decisions, implementation details, infrastructure
concerns, and delivery operations. Do not transform implementation constraints
into product/domain rules or invent requirements that have not been established.

A Functional Specification owns approved feature behavior. A Technical Design
owns the target technical design for an authorized work scope. Current
architecture documentation owns architecture that is effective now. An ADR owns
rationale for a durable structural architecture decision. A top-level GitHub
Issue owns operational Work identity. GitHub Sub-issues own Task execution units.
Tasks and working artifacts reference upstream owners rather than duplicating
them.

When implementation or review reveals a conflict, route it back to the owner and
role authorized to resolve it instead of silently reconciling it.

Repository documentation is canonical in English. Discussion may be in French.
When modifying code, explain the changes made and preserve the project's
conventions and validation expectations.
```
