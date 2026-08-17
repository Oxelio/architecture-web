# Architecture Web — Documentation conventions

> **Content status:** Canonical
>
> **Document type:** Project Governance
>
> **Domain:** Documentation Governance

Architecture Web adopts the generic [artifact ownership](../method/artifact-ownership.md)
and [truth model](../method/core-model.md). This document owns only project-specific
documentation policy and metadata conventions.

## 1. Canonical language

Repository documentation is maintained in **English**.

French or another language may be used during conversation, brainstorming, or
Exploration, but accepted knowledge is integrated once into the canonical
English owner. Parallel hand-maintained translations are not a source of truth.

User-facing localization is different: localization files are product assets,
not duplicate architecture documentation.

## 2. Git history

Architecture Web follows the method rule that Git is documentation history. Do
not keep ordinary `old`, `backup`, `v2`, dated, or translated copies to preserve
previous documentation states.

## 3. Metadata

Existing process artifacts may use these fields:

```markdown
**Lifecycle:** <artifact/work-scope maturity>
**Content status:** <Canonical | Proposed | Hypothesis | Historical Record>
**Document type:** <type>
**Domain:** <domain>
```

`Lifecycle` in existing documents predates the generic Work State model. It
MUST NOT be interpreted as a requirement that the artifact name or maturity
value is itself a Work State.

For new method-oriented working artifacts, prefer explicit fields such as
`Work State`, `Activity`, `Artifact status`, or `Content status` when they avoid
ambiguity.

## 4. Project owner bindings

Architecture Web's semantic owner bindings are listed once in the
[Project Method Profile](project-method-profile.md). Dependent documents should
link to their owner rather than reproduce the same normative rule.

## 5. Exploration and working artifacts

Exploration, Context Manifests, Working Decision Logs, handoffs, and Readiness
records are working context unless another document type explicitly owns the
accepted durable conclusion.

Do not simply rename an Exploration into a Functional Specification and leave
hypotheses/rejected options looking normative.

## 6. Documentation effort

Use documentation proportionally. A small established defect or documentation
repair does not need the same durable artifact set as a new behavior, structural
architecture decision, migration, or other Complex work.
