# Architecture Web — Documentation conventions

> **Lifecycle:** Approved
>
> **Content status:** Canonical
>
> **Document type:** Project Governance
>
> **Domain:** Documentation Governance

## 1. Canonical language

Repository documentation is maintained in English.

French or another language may be used during conversation, brainstorming, or
exploration, but accepted knowledge is integrated once into the canonical
English document. Parallel hand-maintained translations are not a source of
truth and must not be required for a change to be complete.

User-facing product localization is different: UI translation files may exist
for every supported locale because they are product assets, not duplicate
architecture documentation.

## 2. Git is the only documentation history

Keep one current file per subject. Do not create ordinary `old`, `backup`,
`v2`, dated, or translated copies to preserve history. Use commits and tags to
retrieve previous states.

## 3. Lifecycle and content status

Process artifacts may use these metadata fields:

```markdown
**Lifecycle:** <state>
**Content status:** <Canonical | Proposed | Hypothesis | Historical Record>
**Document type:** <type>
**Domain:** <domain>
```

`Lifecycle` describes maturity or execution state. `Content status` describes
the authority of the written information. They are not synonyms.

Canonical governance and architecture references do not need to move through
every feature lifecycle state.

## 4. Ownership

Every durable fact should have one identifiable owner:

- Project Vision owns top-level project intent;
- Architecture Principles own durable design constraints;
- Scope owns what the project is currently trying to cover;
- a Functional Specification owns approved behavior for its feature;
- a Technical Design owns the architecture for one approved feature;
- an ADR owns the rationale and consequences of one durable architecture
  decision;
- code and executable tests provide evidence of current implementation;
- reference documents describe interfaces or operational facts without
  redefining business behavior.

A dependent document may summarize a fact, but it should link to its owner and
must not create a competing normative variant.

## 5. Exploration is not specification

An Exploration may contain hypotheses, discarded options, unresolved questions,
trade-offs, spikes, and contradictory ideas. Its accepted conclusions are
integrated into the owner document. Do not simply rename an exploration into a
Functional Specification and leave exploratory material looking normative.

## 6. Current truth and historical rationale

A current owner document answers **what is true now**. An ADR answers **why a
structural architecture decision was made**. Git answers **what used to be
written**. Do not use ADRs as a changelog or duplicate current specifications
inside them.

## 7. Documentation is proportional to risk

Not every change needs every artifact. A small bug can move directly from Task
to Implementation and Review. A cross-cutting architecture decision may move
from Exploration to ADR and architecture documentation without a Functional
Specification.

Use an artifact only when it improves understanding, decision quality,
traceability, or verification.
