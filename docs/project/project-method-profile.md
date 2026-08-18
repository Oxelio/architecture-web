# Architecture Web — Project Method Profile

> **Content status:** Canonical
>
> **Document type:** Project Method Profile
>
> **Domain:** Project Governance

## 1. Method adoption

Architecture Web adopts the canonical [Software Engineering Method](https://github.com/Oxelio/software-engineering-method).
The method repository owns generic work-governance semantics; this profile binds
those semantics to Architecture Web's canonical project sources and owns
Architecture Web-specific extensions, deviations, and bindings.

Architecture Web MUST NOT maintain a competing normative copy of the adopted
method. Method changes are proposed in the method repository; project adoption
changes remain owned by this profile.

## 2. Canonical project bindings

| Method binding              | Architecture Web owner                                    |
| --------------------------- | --------------------------------------------------------- |
| `project.vision`            | [Project vision](vision.md)                               |
| `project.scope`             | [Project scope](scope.md)                                 |
| `governance.documentation`  | [Documentation conventions](documentation-conventions.md) |
| `governance.delivery`       | [Architecture Web delivery profile](delivery-pipeline.md) |
| `architecture.principles`   | [Architecture principles](architecture-principles.md)     |
| `architecture.current`      | [Architecture overview](../architecture/overview.md)      |
| `architecture.dependencies` | [Dependency rules](../architecture/dependency-rules.md)   |
| `architecture.packages`     | [Packages and public APIs](../architecture/packages.md)   |
| `architecture.decisions`    | [ADR register](../architecture/decisions/README.md)       |
| `development.conventions`   | [Development conventions](../development/conventions.md)  |
| `validation.policy`         | [Testing and verification](../development/testing.md)     |
| `agents.operations`         | [`AGENTS.md`](../../AGENTS.md)                            |
| `agents.project_context`    | [AI project context](../ai/project-context.md)            |

The `governance.delivery` binding also resolves Architecture Web's concrete
operational Work tracking and AI tool-mutation policy. Separate bindings are not
used while the delivery profile intentionally owns these subjects together.

Functional behavior owners are discovered through the
[Functional Specification catalog](../specifications/README.md). Active
non-normative Exploration artifacts are indexed in
[Active explorations](../explorations/README.md).

GitHub Issues and the Architecture Web GitHub Project are external operational
owners only for the subjects assigned and effectively activated by
`governance.delivery`; they do not replace repository-owned product,
architecture, governance, or validation truth.

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

Material Governance Changes to Architecture Web project policy or to the adopted
Software Engineering Method require explicit acceptance by a human Architecture
Web maintainer acting as governance authority before the proposed governance is
considered accepted.

AI may analyze, draft, review, and recommend Governance Changes, but MUST NOT
treat a rule as accepted merely because it exists on a branch, appears in a Pull
Request, passes an AI review, or is technically mergeable. Technical capability
to merge does not grant governance authority.

Governance acceptance MUST be explicit, attributable to the human authority, and
identify the accepted scope. It MAY be recorded in the owning Work, Pull Request
review/conversation, or another project-owned approval record that can be linked
to the change.

### Initial governance-authority bootstrap

The first change that introduces this governance-acceptance rule cannot derive
its own legitimacy from the rule being introduced. Initial adoption therefore
requires an explicit statement from a human exercising pre-existing project or
repository ownership/maintainership authority, independently of this proposed
rule.

That statement MUST identify the governance target being adopted and be recorded
in an attributable project record, such as the Pull Request conversation or
review. Until such an initial adoption statement exists, the proposed governance
remains a Proposed Target even if the branch is technically mergeable.

After the initial rule is validly adopted and becomes effective, subsequent
material Governance Changes follow the governance-acceptance policy above.

For repository-owned governance, merge makes an already-accepted target effective
when the merged canonical document is the owner of that policy. Merge by itself
MUST NOT be interpreted as creating the missing governance acceptance.

A separate human Readiness approval is not required by default. Readiness may be
assessed by the responsible human/AI workflow unless a specific Work or risk
policy explicitly requires additional approval.

Operational access to GitHub does not grant additional decision authority. AI
mutations must independently satisfy the active Role authority, applicable gates,
and the operational permission matrix owned by `governance.delivery`.

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
