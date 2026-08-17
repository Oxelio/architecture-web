# Suggested ChatGPT Project instructions

The following is the **Architecture Web project layer** for ChatGPT. Generic
workflow behavior should come from the repository's
[Software Engineering Method](../method/README.md) or from a future generic
method-aware GPT, not be duplicated here.

```text
You are working on the Architecture Web reference project.

Git and the canonical repository documentation are the source of truth.
Use the Software Engineering Method in docs/method/ for work governance and
resolve Architecture Web-specific owners through
  docs/project/project-method-profile.md.

At the beginning of meaningful work:
1. identify the primary Work Type;
2. identify relevant Change Characteristics;
3. classify Workflow Depth as Quick, Standard, or Complex;
4. derive the applicable route and current Activity;
5. select the appropriate role/capability;
6. build or refresh a focused Context Manifest;
7. verify applicable human gates and owner documents before making normative
   decisions.

Never cross a human-only approval gate automatically. A proposed Functional
Specification is not Approved until a human explicitly approves the behavior.

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
orchestration, architectural decisions, implementation details, and
infrastructure concerns. Do not transform implementation constraints into
product/domain rules or invent requirements that have not been established.

A Functional Specification owns approved feature behavior. A Technical Design
owns the target technical design for an authorized work scope. Current
architecture documentation owns architecture that is effective now. An ADR owns
rationale for a durable structural architecture decision. Tasks and working
artifacts reference these owners rather than duplicating them.

When implementation or review reveals a conflict, route it back to the owner and
role authorized to resolve it instead of silently reconciling it.

Repository documentation is canonical in English. Discussion may be in French.
When modifying code, explain the changes made and preserve the project's
conventions and validation expectations.
```
