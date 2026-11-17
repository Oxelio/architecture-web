# Localized Web validation and API error feedback

> **Identifier:** SF-WEB-ERROR-FEEDBACK-001
>
> **Artifact status:** Approved
>
> **Content status:** Approved
>
> **Document type:** Functional Specification
>
> **Domain:** Web user experience / IAM error presentation

## Work / authority context

**Work:** [#144 — Localize user-facing form validation and API error messages](https://github.com/Oxelio/architecture-web/issues/144)

**Work Type:** Product Behavior Change

**Approval:** Human Functional Approval recorded for the Option B scope in [Work #144](https://github.com/Oxelio/architecture-web/issues/144#issuecomment-6962254613) on 2026-11-17. This document is the **Approved Target** for the defined Work scope; it is not effective Current Truth on `main` until implementation and governed integration.

**Source Exploration:** [#144 exploration findings](https://github.com/Oxelio/architecture-web/issues/144#issuecomment-6962044976)

**Applicable feature and boundary owners:** [Password policy](SF-PASSWORD-001.md), [account recovery](SF-ACCOUNT-RECOVERY-001.md), [MFA](SF-MFA-001.md), [security configuration](SF-SECURITY-CONFIG-001.md), [user administration](SF-ADMIN-USERS-001.md), [HTTP reference](../reference/http-api.md) and [dependency rules](../architecture/dependency-rules.md). Their existing functional and transport semantics remain authoritative within their respective scopes.

## 1. Business context / problem

The existing Web application presents some expected validation and API errors through localized copy, while other visible error surfaces show English API codes, library-generated text, or French-only literals regardless of the selected interface language. This makes valid feedback difficult to understand and can expose implementation details. Existing specifications address certain feature-specific feedback but do not establish a general localized Web error-presentation contract.

## 2. Functional objective

Users receive understandable, context-appropriate, accessible feedback for **existing** client-validation and API/application failures, in the selected supported Web interface language. The improvement changes presentation only: domain rules, authorization, stable machine-readable error codes, HTTP status semantics and technical failure handling are preserved.

## 3. Actors and authorization

- Anonymous users: registration, sign-in, second-factor challenge, account recovery and verification journeys.
- Authenticated users: existing profile, password, email, session and account-security operations.
- Authorized administrators: existing user-administration and security-configuration operations.

These actors retain exactly their pre-existing permissions, account-state rules and available operations.

## 4. Scope and non-goals

**In scope:** Error feedback already displayed by existing Web forms and API-backed actions, including registration, sign-in and MFA challenge, recovery/reset, email verification, profile and security management, user administration, and security-configuration administration. This includes field errors, form-level notices and currently used in-page alerts/feedback. Both currently supported Web locales—French (`fr`) and English (`en`)—are in scope.

**Non-goals:** New locales; wholesale translation of unrelated page content; creation or modification of business errors, password/account/registration policies or authentication semantics; HTTP/API schema or error-code changes; service-side translation; database/schema changes; replacing observability or server logging; redesigning every screen or introducing a new notification channel. Work #142 separately owns missing field feedback and uncaught Zod errors; #143's prior authentication investigation is not reopened.

## 5. Functional rules and invariants

1. The displayed message for a recognized error condition MUST use the currently selected supported Web locale. Presentation MUST NOT display a raw stable error code, an upstream English message, a library error object, a stack trace, or a technical identifier as its user-facing explanation.
2. Expected client-side field-validation failures MUST have understandable localized text, including required fields, identifier format (email/username as currently allowed), password policy bounds and exact password-confirmation matching where applicable. Existing policy constraints and server authority are unchanged.
3. Known expected API/application error codes that an existing Web operation can surface MUST resolve to safe, context-appropriate localized feedback. Messages MAY be deliberately generic when specific detail would violate an existing feature's security or privacy policy.
4. Unknown or unexpected failures, malformed error envelopes and unavailable translations MUST use a safe, localized fallback for the active locale, rather than leaking codes, raw exception text or implementation details. They remain unexpected technical failures; this presentation requirement MUST NOT classify them as expected domain outcomes.
5. For sign-in, including second-factor failures where applicable, feedback MUST NOT disclose whether an account exists, which credential is incorrect, whether an account is verified, or other authentication-sensitive distinctions beyond existing authorized information. In particular, `authentication.invalid_credentials` maps to a generic localized sign-in failure.
6. Existing account-recovery non-enumeration behavior, feature authorization, and other sensitive error-disclosure restrictions remain effective. Presentation MUST NOT reveal new information by using a more specific translation.
7. API/application error codes, request/response structures, status semantics and existing security-relevant outcomes remain unchanged. Message localization belongs to the user experience, not to the stable machine contract.
8. When the Web locale changes while feedback is still visible, that same failure MUST be presented in the newly selected locale without another API request or altered business outcome. Clearing or replacing feedback continues to follow the existing interaction.
9. Form-level errors MUST remain perceivable to assistive technology; field errors MUST remain identifiable with the affected field. The localization change MUST preserve existing successful submissions, loading states and navigation.

## 6. States and significant transitions

- On invalid local input: show corresponding localized field feedback without sending an invalid submission when the existing client validation blocks it.
- On an expected API failure: preserve the failed operation and display mapped localized feedback at the existing appropriate surface.
- On an unknown/technical failure: preserve failure semantics and display a localized non-sensitive fallback.
- On a locale switch while a failure remains displayed: change presentation language, not error identity, form contents, permission, network request or operation state.
- On correction, new attempt, dismissal or successful completion: preserve each existing form's ordinary feedback lifecycle.

## 7. Functional dependencies and interactions

- The [HTTP contract](../reference/http-api.md) provides stable machine-readable errors. No human-readable server `message` field becomes a source of Web presentation truth.
- [Password feedback](SF-PASSWORD-001.md) owns password constraints and prohibited disclosures, while this specification owns their proposed Web localization behavior.
- [Recovery](SF-ACCOUNT-RECOVERY-001.md), [MFA](SF-MFA-001.md), [security configuration](SF-SECURITY-CONFIG-001.md) and [user administration](SF-ADMIN-USERS-001.md) continue to own their respective business and authorization behavior.
- #142's resolver/rendering correction may be an execution prerequisite for field-error interaction tests, but #144 MUST NOT silently implement or close #142.

## 8. Observable behavior / UX expectations

- French selection yields French explanatory text; English selection yields English explanatory text for equivalent errors.
- Field-level messages appear at the affected control; form/action errors appear at their existing form-level or alert surface.
- Error copy describes a safe corrective action when one can be stated without exposing sensitive details (for example, correct an invalid identifier format or retry a temporarily unavailable operation).
- A message missing a specific translation still uses a localized generic fallback. No translation key or raw API code is displayed.
- A displayed error follows a later locale switch without needing a resubmission.

## 9. Errors, edge cases and failure behavior

- Examples of known conditions to cover include invalid/empty login identifiers, password policy and confirmation failures, `authentication.invalid_credentials`, supported MFA failures, `user.already_exists` where already exposed, and existing recovery, account/profile, administration and configuration error outcomes.
- Username registration MUST NOT imply that an email address is mandatory; messages must match the selected allowed identifier kind.
- Signup conflict feedback MUST NOT misleadingly describe a username conflict as an email-address conflict. Preserve existing endpoint semantics and security restrictions.
- HTTP errors without a usable code, non-JSON replies, network failures, unrecognized codes, and unexpected exceptions must render the appropriate safe localized fallback without displaying their raw details.
- Unknown or newly introduced error codes MUST NOT be silently represented as a different known business error merely to obtain a translated string.

## 10. Security and privacy requirements

- Keep existing anti-enumeration protections for authentication and recovery; avoid sensitive identifiers, tokens, passwords, stack traces and implementation diagnostics in UI feedback.
- Do not change which users can call any operation, what error codes are returned by the API, or how unexpected failures are handled by application/service infrastructure.
- Existing technical diagnostics and audit obligations remain intact; this Work neither mandates new client logging nor authorizes exposing sensitive failure details in observability.

## 11. Functional alternatives considered

**A — Localize registration and sign-in only.** Lower immediate scope, but known raw-code presentation elsewhere remains inconsistent with #144's broad objective.

**B — Localize error feedback across existing Web surfaces (proposed).** Establishes a coherent user-facing rule for current supported languages without redefining underlying functional behavior. Requires wider regression coverage and must preserve feature-specific disclosure restrictions.

**C — Translate API response messages server-side.** Rejected as proposed behavior because it couples UI locale presentation to the stable transport/application boundary and risks changing existing clients' response expectations.

**Recommended proposal:** B, limited to existing Web error surfaces and currently supported `fr`/`en` locales; no general UI translation initiative.

## 12. Open functional decisions

- **Human approval required:** accept or revise the proposed cross-Web scope, immediate retranslation on locale change, fallback behavior and security-preserving error distinctions. These are proposed decisions, not implementation authority.
- If an existing feature has an unrecognized disclosure requirement, return the conflict to its owning Functional Specification and request authority instead of inventing an error-specific policy in code.

## 13. Acceptance criteria

- [ ] French and English error feedback is present for known invalid sign-up fields (including username/email kind, password bounds and confirmation) and known sign-in/MFA errors.
- [ ] A returned `authentication.invalid_credentials` code shows an appropriately generic message in each supported locale without account enumeration.
- [ ] Representative expected error codes from existing recovery, profile, user administration and security-configuration flows produce safe messages in both locales; currently exposed raw code and exception surfaces are replaced.
- [ ] An unknown API code, a network failure and an unexpected exception produce a safe localized fallback rather than the raw code, server message or stack trace.
- [ ] Existing field feedback is associated with the relevant input and form-level feedback is accessible; no duplicate request is caused by an error or language change.
- [ ] While an error remains visible, changing the UI language changes that message to the selected locale without submitting again.
- [ ] Password, identity, MFA, authorization and recovery behavior remain unchanged; the Web preserves existing API response/error contracts, successful paths and security disclosure restrictions.
- [ ] Automated tests cover at least `fr` and `en`, known and unknown errors, locale switching, and sensitive authentication-error disclosure. Required validation evidence is provided for the affected UI boundaries.

## 14. Human approval

**Decision:** Approved — Option B and all proposed functional rules, including the acceptance criteria.

**Approved scope:** Sections 2–10 and the acceptance criteria in section 13, using alternative B in section 11; French and English, all existing Web error feedback surfaces, safe generic fallback, immediate locale retranslation, accessible feedback, stable contracts, and security-preserving non-enumeration.

**Authority / record:** Explicit approval by the human project requester in the Architecture Web ChatGPT conversation on 2026-11-17 (“Je valide l'option B avec toutes ces règles.”), transcribed by the coordinator in [Work #144 approval record](https://github.com/Oxelio/architecture-web/issues/144#issuecomment-6962254613). This is a recorded human decision, not AI approval or an independent human GitHub review.

**Implementation status:** Functional target approved; implementation remains pending Technical Design / applicable planning / Readiness. Neither this approval nor a branch commit or PR merge alone establishes current deployed behavior.
