# Architecture Web — Project Method Profile

> **Content status:** Canonical
>
> **Document type:** Project Method Profile
>
> **Domain:** Project Governance

## 1. Method adoption

Architecture Web adopts the repository's [Software Engineering Method](../method/README.md).
The method owns generic work-governance semantics; this profile binds those
semantics to Architecture Web's canonical project sources.

## 2. Canonical project bindings

| Method binding              | Architecture Web owner                                    |
| --------------------------- | --------------------------------------------------------- |
| `project.vision`            | [Project vision](vision.md)                               |
| `project.scope`             | [Project scope](scope.md)                                 |
| `governance.documentation`  | [Documentation conventions](documentation-conventions.md) |
| `governance.delivery`       | [Architecture Web delivery profile](delivery-pipeline.md) |
| `governance.work_tracking`  | [Architecture Web delivery profile](delivery-pipeline.md) |
| `governance.ai_operations`  | [Architecture Web delivery profile](delivery-pipeline.md) |
| `architecture.principles`   | [Architecture principles](architecture-principles.md)     |
| `architecture.current`      | [Architecture overview](../architecture/overview.md)      |
| `architecture.dependencies` | [Dependency rules](../architecture/dependency-rules.md)   |
| `architecture.packages`     | [Packages and public APIs](../architecture/packages.md)   |
| `architecture.decisions`    | [ADR register](../architecture/decisions/README.md)       |
| `development.conventions`   | [Development conventions](../development/conventions.md)  |
| `validation.policy`         | [Testing and verification](../development/testing.md)     |
| `agents.operations`         | [`AGENTS.md`](../../AGENTS.md)                            |
| `agents.project_context`    | [AI project context](../ai/project-context.md)            |

Functional behavior owners are discovered through the
[Functional Specification catalog](../specifications/README.md). Active
non-normative Exploration artifacts are indexed in
[Active explorations](../explorations/README.md).

GitHub Issues and the Architecture Web GitHub Project are external operational
owners only for the subjects assigned by `governance.delivery`; they do not
replace repository-owned product, architecture, governance, or validation truth.

## 3. Project-specific method extensions

Architecture Web adds the following project constraints to the generic method:

- DDD, Clean Architecture, Hexagonal Architecture, and explicit bounded-context
  boundaries as defined by the project architecture owners;
- inward dependency direction and infrastructure-independent domain/application
  layers;
- deliberate package/public API boundaries;
- repository documentation in English;
- project-specific TypeScript, HTTP, React, persistence, and testing conventions;
- architecture review criteria defined by the project architecture documents;
- GitHub-based operational Work/Task tracking and Continuous Flow delivery as
  defined by the delivery profile.

These are **Architecture Web rules**, not generic Software Engineering Method
invariants.

## 4. Human authority policy

Human Functional Approval is required before proposed product behavior becomes
`Approved`.

Durable structural ADR decisions require explicit project acceptance before an
ADR becomes `Accepted`. AI may prepare and recommend an ADR decision but must
not claim that a proposed structural decision was human-approved when it was not.

A separate human Readiness approval is not required by default. Readiness may be
assessed by the responsible human/AI workflow unless a specific Work or risk
policy explicitly requires additional approval.

Operational access to GitHub does not grant additional decision authority. AI
mutations must comply with the active Role and the operational permission matrix
owned by `governance.delivery`.

## 5. Documentation policy value

Architecture Web's canonical repository documentation language is **English**.
This project value is owned by [Documentation conventions](documentation-conventions.md),
not by the generic method.

## 6. Method deviations

No intentional deviation from the Software Engineering Method is currently
registered.

If a future project rule contradicts a method invariant, document the conflict,
rationale, authority, and scope explicitly instead of silently redefining the
method in a project guide or AI prompt.
