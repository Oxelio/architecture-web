# Exploration — Configurable user registration

> **Lifecycle:** Exploration
>
> **Content status:** Proposed
>
> **Document type:** Exploration
>
> **Domain:** Identity and Access Management

**Related documents:**

- [Project scope](../../project/scope.md)
- [Architecture principles](../../project/architecture-principles.md)
- [Dynamic security configuration](../../specifications/SF-SECURITY-CONFIG-001.md)

## Position in the pipeline

**Why this is in Exploration:** the product direction is clear enough to state
several requirements, but the complete registration policy, invariants,
validation modes, and edge-case behavior have not yet been decided.

**To move to Design:** define the full configurable registration behavior,
resolve blocking policy combinations, identify the minimum account invariants,
and write a Functional Specification with testable acceptance criteria.

## 1. Problem / need

User registration should not be hard-coded to a single product policy.
Authorized administrators should be able to configure how a new user account
may be created without requiring a deployment for ordinary policy changes.

The goal is to support different application needs while keeping registration
rules coherent and centrally governed.

## 2. Actors and desired outcome

### Anonymous / end user

May be allowed to create their own account when self-registration is enabled by
configuration.

### Administrator

May be allowed to create an account for another user when administrator-driven
registration is enabled by configuration.

### Authorized configuration administrator

Can define the global registration policy used by the application.

## 3. Established requirements

The following requirements are established for the exploration:

- registration configuration is global to the application;
- self-registration and administrator-created accounts are both possible paths,
  depending on configuration;
- the policy can define whether user information is required, including at
  least email, phone number, first name, and last name;
- validation requirements may depend on configuration;
- code implementing the eventual behavior must preserve the project's DDD,
  Clean Architecture, and Hexagonal Architecture boundaries.

These requirements do not yet define the complete policy model.

## 4. Scope being explored

The exploration should determine at least:

- which registration paths can be independently enabled or disabled;
- which account attributes can be required, optional, or unavailable;
- whether email and phone verification requirements are configurable;
- whether different registration paths can have different requirements;
- which validation rules are intrinsic to a value and which are policy-driven;
- what minimum information is required for an account to exist at all;
- what happens when a submitted registration does not satisfy the effective
  policy;
- how invalid or contradictory administrator configurations are prevented;
- when a policy change becomes effective for in-progress registration attempts.

## 5. Functional options to compare

### One global registration policy for all creation paths

Self-registration and administrator-created registration use the same required
attributes and validation rules, with only path enablement differing.

This is simpler and easier to explain, but may be too restrictive if an
administrator needs to create an incomplete account that the user completes
later.

### Global policy with path-specific rules

The application still has one global registration configuration, but it can
contain separate rules for self-registration and administrator-created
accounts.

This is more expressive but introduces more policy combinations and requires a
clear definition of which invariants remain universal.

### Required / optional / disabled attribute states

Each configurable attribute can have an explicit state rather than a boolean
`required` flag. This may make policy intent clearer when an attribute must not
be collected at all, but it increases configuration complexity.

No option in this section is approved yet.

## 6. Functional invariants to clarify

Questions that must be resolved before a specification can be approved include:

- Can an account exist without both email and phone number?
- Is there always at least one unique login identity at creation time?
- Are authentication credentials part of registration or a separate activation
  journey for some account-creation paths?
- Can an administrator create an account that is not immediately usable?
- Is first/last name purely profile information, or can another business rule
  make it mandatory independently from registration configuration?
- Are verification requirements part of registration completion, account
  activation, or a later state transition?

These are business decisions; the implementation must not answer them
implicitly.

## 7. Interaction with dynamic security configuration

The existing
[Dynamic security configuration specification](../../specifications/SF-SECURITY-CONFIG-001.md)
already establishes a configuration center and includes public sign-up as a
configurable capability.

The future registration specification must decide whether registration policy
is owned by that broader security configuration model or by a dedicated
Identity registration policy exposed through the same administration
experience. This ownership question has architectural consequences and may
require a Technical Design or ADR later, but it is not decided by this
exploration.

## 8. Risks and trade-offs

- A fully generic key/value policy could make business invariants difficult to
  understand and validate.
- Excessive configurability can create invalid combinations or user journeys
  that cannot be completed.
- Treating policy-driven requirements as value-object invariants would make
  runtime configuration difficult and couple the domain model to mutable
  policy.
- Different self/admin rules can create accounts in states that downstream use
  cases are not prepared to handle.
- Policy changes can create race conditions if the policy is read at different
  moments of one registration journey.

## 9. Open questions

- Exact list of configurable account attributes.
- Required/optional/disabled semantics for each attribute.
- Whether self-registration and administrator creation share one rule set.
- Verification policy for email and phone.
- Credential/activation behavior for administrator-created accounts.
- Minimum universal account invariants.
- Policy snapshot versus latest-policy behavior during a multi-step journey.
- Audit requirements for registration-policy changes and account creation.
- Compatibility with existing account creation and security configuration.

## 10. Expected next artifact

Once the blocking functional questions are resolved, create a Functional
Specification for configurable user registration. Only after that specification
is `Approved` should the project define the implementation architecture in a
Technical Design.

If the Technical Design uncovers a durable structural choice with several
reasonable alternatives — for example ownership of registration policy or a
cross-cutting configuration strategy — record that decision in an ADR.
