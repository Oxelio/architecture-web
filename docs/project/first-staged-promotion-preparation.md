# First staged promotion preparation

> **Content status:** Proposed
>
> **Document type:** Release Preparation Plan
>
> **Domain:** Delivery
>
> **Parent Work:** #24
>
> **Task:** #30

## 1. Purpose and authority

This is a non-normative working artifact for preparing the first normal staged
promotion from `development` through a short-lived `release/*` branch toward
`main`.

It does not redefine release governance. Normative release semantics remain owned
by [Architecture Web delivery profile](delivery-pipeline.md), project owner
resolution remains owned by the
[Project Method Profile](project-method-profile.md), and validation policy remains
owned by [Testing and verification](../development/testing.md).

The implemented delivery-control-plane Technical Design is relevant evidence for
the default-branch bootstrap constraint, but it is not a competing governance
owner.

This preparation does not create a release branch, promote a candidate, deploy an
environment, grant merge authority, or execute Human Release Approval.

## 2. First Release Work opening contract

Open one top-level GitHub Issue as the Release Work before creating the candidate
branch. For a pure operational promotion that preserves already-authorized
behavior, classify it as `Technical Change` with the `operational` Change
Characteristic. Workflow Depth remains risk-based.

The Release Work must record or reference:

- included Work / release scope;
- the exact `development` candidate SHA once selected;
- the planned short-lived `release/*` ref;
- candidate artifact identity when an immutable artifact exists;
- beta validation evidence;
- candidate-specific Human Release Approval;
- Release Promotion Gate evidence;
- production promotion/deployment evidence;
- post-promotion `main` / `development` synchronization evidence when required.

These are operational references. The Release Work must not duplicate product,
architecture, governance, or validation truth owned elsewhere.

## 3. Candidate selection strategy

Candidate selection happens during Release Work preparation, after all Work
intended for the release is integrated into `development`.

1. Fetch `main` and `development` and verify that `development` still descends
   from `main`. If shared ancestry cannot be established, stop and route the
   repository-history problem to the appropriate governance activity.
2. Resolve one exact `development` commit SHA as the candidate source. Record the
   SHA and included Work scope in the Release Work.
3. Complete the candidate-bound repository validation required by section 4.
4. After Readiness permits implementation, create the short-lived `release/*`
   branch from that exact SHA. Do not create it from a moving branch name without
   first recording the resolved SHA.
5. Treat the release-branch head SHA as the promotion candidate. If a correction
   changes that SHA, previous beta evidence and Human Release Approval do not
   automatically apply to the new candidate.

Do not rewrite `main`, `development`, or the release branch to preserve an old
candidate identity. Corrections use ordinary commits/authorized correction Work
and repeat the evidence invalidated by the change.

## 4. Required repository and beta evidence

### 4.1 Candidate-bound repository evidence

Under the current human-directed validation model, a human validator supplies
pre-promotion repository evidence and binds it to the exact candidate SHA.

For the first staged promotion, use the full repository checks relevant to the
cross-system/operational release boundary:

```bash
git status --short
git rev-parse HEAD
pnpm build
pnpm typecheck
pnpm typecheck:test
pnpm lint
pnpm test
pnpm format:check
pnpm docs:links
pnpm docs:links:test
```

The evidence record must identify the human validator, candidate SHA, commands,
results, and any material environment/tooling notes. Existing warnings may be
recorded as warnings; errors or non-zero command results are failures unless the
canonical validation policy explicitly establishes otherwise.

If the candidate changes, rerun the checks whose evidence could have been
invalidated, proportional to the changed boundary and risk.

### 4.2 Beta evidence

Before Human Release Approval, beta evidence must demonstrate all of the
following for the exact current candidate/artifact:

- the intended candidate source SHA and artifact identity, when applicable, are
  unambiguous;
- the candidate has been deployed through the activated beta delivery mechanism;
- deployment evidence identifies the candidate/artifact actually deployed;
- required repository validation for that candidate is sufficient;
- applicable beta environment health/smoke evidence provided by the activated
  deployment mechanism is successful;
- no unresolved release blocker or out-of-authority Working Decision remains.

Do not invent a beta deployment or smoke-test mechanism if none is activated. If
`beta` or its deployment/evidence mechanism is unavailable, the Release Work
stops in the activity authorized to resolve that prerequisite and records the
mechanism as unavailable.

## 5. Human Release Approval boundary

Human Release Approval remains a human-only Authority Gate. It may occur only
after sufficient beta evidence exists for the current candidate.

The human Architecture Web maintainer acting as Human Release Authority must make
an explicit candidate-specific decision. For the currently implemented V1 gate
evaluator, use the established Release Work comment record:

```text
<!-- architecture-web:human-release-approval:v1 -->
Authority: Human Release Authority
Decision: APPROVED | REVOKED
Candidate Source Ref: release/...
Candidate Source SHA: <40-hex commit SHA>
Candidate Artifact Identity: <identity> | none
```

A changed candidate invalidates the previous approval. Merge capability, PR
review capability, environment approval, or repository write permission does not
substitute for Human Release Approval.

## 6. Release Promotion Gate inputs

Before a `release/* -> main` promotion may be merged, evaluate the semantic
Release Promotion Gate against the current candidate. The evaluation must have
references for:

- identifiable Release Work and same-repository open `release/* -> main` PR;
- exact candidate source ref and SHA;
- candidate artifact identity when applicable;
- sufficient beta evidence;
- candidate-specific Human Release Approval;
- applicable repository checks/protections for the promotion PR;
- resolved release blockers;
- resolved out-of-authority Working Decisions.

The gate result is evidence only. PASS does not create merge authority and does
not execute deployment.

## 7. First-promotion default-branch bootstrap

The first staged promotion has an explicit bootstrap constraint:

- `main` is the repository default branch;
- `delivery-release-promotion-gate.yml` is present on `development` but is not
  yet present on `main` before the first promotion;
- GitHub `workflow_dispatch` publishers therefore remain operationally
  unavailable until the workflow path reaches the default branch.

This unavailability does not waive the semantic Release Promotion Gate. For the
first promotion, evaluate the gate from the evidence listed in section 6 and
record the result on the Release Work without claiming that the automated Check
Run publisher executed.

The automated publisher is not a prerequisite for the first promotion unless it
has already become separately activated and verified. Repository checks or
protections that are actually configured for the promotion PR remain applicable.

After the first stable promotion puts the workflow path on `main`:

1. keep the publisher marked unavailable until live verification succeeds;
2. dispatch `delivery-release-promotion-gate.yml` against an explicitly selected
   authorized ref such as `development` when a safe verification candidate is
   available;
3. verify that the evaluator/publisher binds its result to the expected candidate
   SHA and publishes the fixed Release Promotion Gate Check Run;
4. record successful activation evidence in the appropriate activation owner;
5. if verification fails, keep the publisher unavailable and route the failure
   to separate Technical/Governance Work rather than retroactively treating the
   first promotion as publisher-validated.

No default-branch change, direct `development -> main` shortcut, or temporary
bypass workflow is introduced for bootstrap convenience.

## 8. Stop and rollback conditions

Stop before creating or promoting a candidate when any applicable condition is
true:

- `development` no longer has the required shared ancestry with `main`;
- candidate SHA or included release scope is ambiguous;
- required candidate-bound repository validation is failing or insufficient;
- beta/deployment evidence is unavailable or does not identify the current
  candidate/artifact;
- the candidate changed after accepted beta evidence without revalidation;
- Human Release Approval is missing, revoked, stale, or identifies another
  candidate;
- the Release Promotion Gate is not PASS;
- applicable repository checks/protections are failing or unreadable;
- a release blocker or out-of-authority Working Decision remains unresolved;
- merge authority for the promotion has not been separately established.

If a release candidate fails before promotion, correct it through authorized
release-candidate Work/commits and repeat invalidated validation and approval.
Do not force-update protected history to recover the candidate.

If a material problem is discovered after promotion, do not rewrite `main` as a
rollback mechanism. Open/route the appropriate correction or revert Work, use the
authorized repository process, and preserve audit/history. Synchronize `main`
back into `development` when required by the delivery policy after stable
promotion/correction.

## 9. Release Work handoff checklist

A future Release Work can start from this preparation by filling these values
without redefining release semantics:

```text
Release Work: #<issue>
Classification: Technical Change
Change Characteristics: operational (+ others if discovered)
Workflow Depth: <risk-based value>
Included Work / scope: <refs>
Candidate development SHA: <40-hex SHA>
Release branch: release/<identifier>
Candidate release SHA: <40-hex SHA once created>
Candidate artifact identity: <identity | none>
Repository validation evidence: <ref>
Beta deployment/evidence: <ref>
Human Release Approval: <ref>
Promotion PR: <release/* -> main PR>
Repository checks/protections evidence: <ref>
Release blockers resolved: <ref>
Working Decisions resolved: <ref>
Release Promotion Gate evaluation: <PASS/FAIL + evidence ref>
Merge authority: <separate human/repository authority ref>
Production promotion/deployment evidence: <ref>
main -> development synchronization evidence: <ref when required>
Publisher bootstrap verification: <ref or explicitly unavailable>
```

Any value whose backing mechanism is not available is recorded as unavailable and
becomes an explicit prerequisite/blocker; it is not replaced with an invented
parallel mechanism.

## 10. Completion boundary for Task #30

Task #30 is complete when this preparation has been reviewed and validated as a
coherent application of the canonical delivery and validation owners.

Task #30 itself must not:

- create a `release/*` branch;
- open or merge a promotion PR;
- change `main` or `development`;
- deploy beta or production;
- execute Human Release Approval;
- claim the default-branch publisher is active before live verification.
