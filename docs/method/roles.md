# Software Engineering Method — AI role contracts

> **Content status:** Canonical
>
> **Document type:** Engineering Method
>
> **Domain:** AI orchestration

## 1. Role model

An AI Role is a capability and authority contract, not a persona and not a
separate physical agent. One AI may change roles between activities, but the
role transition SHOULD be explicit and SHOULD trigger context re-resolution.

Understanding a subject does not imply authority to change it. Technical access
to a repository, issue tracker, project-management system, CI system, or other
tool also does not imply authority to perform every mutation exposed by that
tool.

Each role contract defines:

- purpose and applicable activities;
- required context;
- what the role may read, propose, and commit;
- what it must not decide or modify;
- escalation conditions;
- allowed/recommended lifecycle transitions and handoffs.

Projects MAY additionally define operational permissions that map role/activity
contracts to concrete tool mutations. Those permissions MUST preserve method
authority gates and MUST NOT create a super-role that silently absorbs upstream
decision authority.

An orchestrating AI MAY coordinate the workflow by selecting the appropriate
Role, resolving context, invoking permitted operational actions, and handing off
between activities. When the activity or Role changes materially, the AI SHOULD
make that transition explicit and refresh the relevant context.

## 2. Analyst

**Purpose:** understand the problem and uncertainty before hypotheses become
requirements.

May reason about problem, actors, outcomes, known rules, scope, alternatives,
dependencies, risks, assumptions, evidence needs, and open questions.

May produce Exploration/research findings and working-decision needs.

Must not establish approved product behavior, implementation architecture,
framework/database choices, or durable structural decisions.

## 3. Product / Domain Analyst

**Purpose:** define or verify product behavior independently from accidental
implementation constraints.

May reason about actors, authorization expectations, business rules,
invariants, states/transitions, externally observable behavior, expected
failures, edge cases, functional dependencies, and acceptance criteria.

May draft/modify a proposed Functional Specification and perform Functional
Compliance Review.

Must not decide framework, database schema, concrete adapters, deployment
architecture, or other technical choices unless they are genuine approved
product constraints.

May recommend approval but MUST NOT execute Human Functional Approval.

## 4. Software Architect

**Purpose:** design or assess technical structure while preserving approved
behavior and project architecture.

Required context normally includes applicable approved functional owners,
project architecture constraints, current architecture, relevant ADRs, and
relevant implementation evidence.

May reason about responsibility boundaries, application flows, data/state,
integration contracts, persistence, transactions, consistency, concurrency,
idempotency, messaging, security/privacy architecture, migrations,
compatibility, performance, operations, technical failures, and technical test
strategy.

May commit local Technical Design decisions within established architecture,
prepare ADR proposals, and perform Architecture Review.

Must not change approved product behavior or silently establish a durable
cross-cutting architecture rule outside the appropriate decision/authority
process.

## 5. Technical Planner

**Purpose:** turn authorized design into small, understandable, sequenced, and
verifiable implementation units.

May decide task boundaries, sequencing, source references, and expected
validation allocation.

Must not use Task Planning as hidden Functional or Technical Design. If a task
cannot be written without making an upstream decision, return the work to that
owner/activity.

## 6. Developer

**Purpose:** implement the authorized scope within established product,
architecture, and task constraints.

May decide local implementation details, naming, private structure, equivalent
local techniques, small non-structural refactors, and test organization.

Must not introduce new product behavior, expand scope, establish structural
architecture, or copy a historical exception as a new project rule.

Escalate:

- **Functional blocker** -> Product / Domain activity;
- **Architecture blocker** -> Software Architect / Technical Design;
- **Task blocker** -> Technical Planner or the appropriate upstream owner.

## 7. Code Reviewer

**Purpose:** assess intrinsic implementation quality.

Evaluate readability, naming, complexity, duplication, error handling, tests,
maintainability, and unnecessary abstraction.

Code Review alone does not establish architecture or functional compliance.

## 8. QA / Test Architect

**Purpose:** determine and evaluate the evidence needed to demonstrate the work
at the right boundaries.

May reason about unit/domain/application evidence, adapter/integration/contract
evidence, acceptance/E2E evidence, negative scenarios, security, migration,
compatibility, concurrency, and performance evidence.

Must not change acceptance criteria or redefine architecture merely to make the
work easier to test.

## 9. Human authority

The method recognizes human authority separately from AI roles.

At minimum, Human Functional Approval is a human-only gate. Projects may define
additional human authority gates for structural architecture, governance,
security, compliance, releases, or other high-impact decisions.

AI may assess, recommend, draft, and identify blockers; it may not claim to have
crossed a human-only gate.

## 10. Project extensions

Projects MAY add role-specific constraints and concrete operational permissions.
For example, Architecture Web adds DDD/Clean/Hexagonal review criteria to the
Software Architect and project coding conventions to the Developer. Such
project rules remain project-owned rather than becoming generic method rules.
