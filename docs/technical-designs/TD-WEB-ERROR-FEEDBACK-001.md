# Technical Design — Web error-feedback localization

> **Identifier:** TD-WEB-ERROR-FEEDBACK-001
>
> **Artifact status:** Prepared for implementation
>
> **Content status:** Proposed Target (Work #144; not effective Current Truth)
>
> **Document type:** Technical Design
>
> **Domain:** Web presentation / IAM integration

## Work context

- **Work:** [#144](https://github.com/Oxelio/architecture-web/issues/144)
- **Work Type / Depth / Characteristics:** Product Behavior Change / Standard / security-sensitive
- **Authorized functional source:** [SF-WEB-ERROR-FEEDBACK-001](../specifications/SF-WEB-ERROR-FEEDBACK-001.md) — **Approved Target**, [human decision](https://github.com/Oxelio/architecture-web/issues/144#issuecomment-6962254613)
- **Existing behavior owners:** [password policy](../specifications/SF-PASSWORD-001.md), [account recovery](../specifications/SF-ACCOUNT-RECOVERY-001.md), [MFA](../specifications/SF-MFA-001.md), [security configuration](../specifications/SF-SECURITY-CONFIG-001.md), [user administration](../specifications/SF-ADMIN-USERS-001.md)
- **Technical constraints:** [architecture overview](../architecture/overview.md), [dependency rules](../architecture/dependency-rules.md), [HTTP API](../reference/http-api.md), [testing](../development/testing.md)
- **Current implementation evidence:** `apps/web/src/i18n.ts`, `components/LanguageSwitcher.tsx`, `services/api.ts`, existing Web page/components and adjacent Vitest tests.
- **Authority:** Software Architect's bounded implementation design within existing architecture; does not establish a project-wide architectural invariant or an ADR.

## 1. Authorized behavior and boundaries

Implement only localization of **existing user-visible form-validation and API error feedback** in the currently supported `fr` and `en` locales. The functional specification owns all observable rules, including active-language rendering, locale switching, safe fallback, field association and non-disclosure. Do not widen the work into translating general page labels or adding previously absent error workflows.

Transport/application/domain semantics remain unchanged. Preserve HTTP statuses, response envelopes, error codes, authentication/recovery non-enumeration, password policies, authorization and unexpected technical failure classification. Work #142 separately owns the uncaught Zod resolver and missing validation feedback defect.

## 2. Ownership and dependency direction

- **Web presentation** owns translation resources, error-code-to-copy mapping, locale-aware rendering and accessibility attributes.
- **Web API client** continues to own HTTP transport decoding and stable error-code propagation, not translated user-facing copy. Its current `requestEnvelope` throws `Error(error.code)` or a technical status marker; no contract rewrite is required.
- **IAM / other application and domain layers** own the meaning of their failures; do not add localization imports, shared domain translations, HTTP-visible copy rules or dependencies on React/i18next.
- **Existing feature specifications** retain their own password, account, MFA, recovery and security semantics.
- A small private Web presentation helper is justified for repeated safe-code resolution. Avoid new generic error frameworks, ports, global error buses or cross-bounded-context models.

## 3. Recommended technical design

### 3.1 Stable error identity, render-time translation

Represent error state by a stable **code/category or translation key plus required non-sensitive parameters**, not by an already-translated sentence. Translate from the active `useTranslation` `t` function **at render time**. Do not store `t(...)` output in React state for still-visible error feedback.

Provide one narrowly scoped Web helper (exact name/file left to Developer) to resolve known error codes **by explicit allowlisted mappings**, optionally scoped by operation (sign-in/MFA, registration, recovery, profile, administration). Translation keys resolve to `i18n.ts` resources. Each recognized code must have safe `fr` and `en` text. An unrecognized code or non-Error value returns a generic, translated error key: never display or interpolate arbitrary `Error.message`, HTTP status strings, translation keys or technical identifiers.

The helper is a presentation concern. Existing client/API error identity should remain available to the caller; it is not necessary to change `services/api.ts` throwing behavior. If the Developer does need an internal typed error representation, preserve every current consumer's observable expectations and test the boundary; do not alter the HTTP wire contract.

### 3.2 Field-validation identifiers

Make Zod/RHF field errors locale-independent and deterministic where local validation is already used: use known semantic validation identifiers and preserve safe interpolation parameters for dynamic requirements (e.g. current sign-up minimum/maximum length). Do not depend on Zod's English default `issue.message` as user-visible copy. Translate at render time, with safe fallback for any unrecognized validator message. Respect the existing email-versus-username selection and don't impose a new login/password policy.

Use `aria-invalid`, `aria-describedby` or an equivalent accessible relationship to associate displayed field errors with their inputs; use perceivable form-level alert/status semantics as appropriate without creating duplicate or unsolicited notices.

Compatibility with Zod 4 and the resolver is addressed by **#142**, not an ad hoc duplicate fix. If #142 is not integrated, implement the translation-only logic and coordinate final interactive form tests with the #142 fix.

### 3.3 Explicit security-safe mappings

- `authentication.invalid_credentials` always maps to a **generic** invalid-credentials message regardless of whether identifier or password failed. Avoid account-lookup/state distinctions.
- Handle actual, verified MFA and other application codes only with context-appropriate safe copy. Unknown code remains generic, not a guess at a business error.
- Preserve recovery/account-verification non-enumeration and unauthorized/forbidden behavior.
- For registration conflict codes, the error text must not incorrectly imply an email is involved when the selected allowed login kind is username. Use a safe contextual or neutral account-conflict translation without changing server conflict semantics.
- Sensitive diagnostics (tokens, passwords, raw exception messages, stacks) must never be interpolated in UI messages. Server/internal diagnostics remain out of this scope.

### 3.4 Existing Web surfaces

Perform a focused inventory of **currently rendered** error surfaces, then change only those surfaces:

- `SignInPage`: `serverError` currently stores raw `error.message` for both password and MFA; store identity and use safe locale-aware resolver. Existing Zod errors for the login/password controls must localize.
- `SignUpPage`: existing localized error key handling can be preserved; replace hardcoded username error and raw/default Zod messages, and make translated field errors update on locale change without changing identifier rules or submitting invalid forms.
- `RecoveryPage`: existing `recoveryErrorMessage` translates in `catch` before saving a string; retain the known-code behavior but persist error identity, localize at render time and preserve masking.
- `VerifyEmailPage`: store status/error identity rather than translated `message` string; do not include language-dependent translation function in an effect that would **re-send verification** on a locale switch. Render copy from status using current locale; token verification must retain its existing single-request-per-token behavior.
- `ProfilePage`, `AdminPage`, `AdminSecurityCenter`: replace UI exposure of appended/raw `error.message` and already translated error-state strings with code-based or safe-key rendering. Preserve successful state notices; no user-operation rule changes.
- `CancelDeletionPage`: translate its existing French-only generic error state, preserving failure behavior.
- `NotificationsPage` and existing `RecoveryPage` cases already use localized safe feedback in some paths; reuse/preserve instead of duplicating them.
- `SecurityCenter` contains API mutations without an existing visible error presentation in some paths. This Work is **not** authorization to add unrelated new error UX; inspect the actual existing display surfaces and defer absent feedback to the appropriate functional owner.
- Do **not** translate notifications' server-owned content or non-error page labels as a side effect.

## 4. Data, state and flows

No new persisted business data, server-side locale, database migration or session state. Browser's existing `locale` preference, `i18next` resources and `LanguageSwitcher` remain the language selection owner.

Flow: API failure/validation issue -> stable identity in current UI state -> safe known-code/validation mapping -> `t(key, parameters)` on render -> visible localized feedback. Locale change -> React translation re-render -> new copy; **no extra API fetch, mutation or form submission**.

Do not put English message text, translated text, or ad-hoc error policy into API request/response shapes.

## 5. Transactions, integration and operational concerns

No new transactions, messaging, cross-context flow, event schema, cache key, HTTP endpoint, data migration or compatibility break. Keep current React Query mutation/retry and form lifecycle behavior; do not swallow unexpected exceptions in application/API logic to make presentation look successful. A UI-safe fallback is a rendering choice, not a reinterpretation of failure.

Translation lookup should be O(1) over static local keys and avoid runtime network translation fetches. Keep i18n keys and translations colocated with current Web resources unless a concrete maintainability need justifies restructuring.

## 6. Validation design and evidence

Under [testing policy](../development/testing.md), use the smallest sufficient evidence:

1. **Pure helper tests:** both `fr`/`en`; known code `authentication.invalid_credentials`, allowed contextual codes, username-vs-email conflicts, unknown/unexpected/transport/malformed responses; assert no raw error, sensitive detail or untranslated key in user copy.
2. **Client-validation tests:** required/invalid email or username, password bounds, confirmation mismatch and field association in both locales. Preserve invalid-request rejection, success path, and baseline sign-in policy.
3. **Interaction tests:** switch language while an error remains visible and assert updated copy **without another API invocation**; explicitly cover verification URL to prevent a second token-verification request due to `t` dependency. Cover MFA/security non-enumeration and form accessibility.
4. **Existing Web test regression:** `pnpm --filter web test`, `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`, and affected test typecheck/build checks; run broader repository suites if impacted boundaries justify them. Use current CI candidate SHA evidence. Existing Vitest environment is `node` and no E2E suite is declared: establish a focused DOM harness only if needed for actual interactive assertions, not a general testing rewrite.
5. **Security and functional reviews:** verify non-enumeration, safe fallback, unchanged HTTP/application codes, no raw exception leakage, and complete coverage of the affected existing error surfaces. Separate Code Review, Architecture Review where relevant, and Functional Compliance Review against the approved specification.

No unit/E2E/runtime tests were executed while authoring this design; execution must generate its own evidence for the relevant candidate.

## 7. Technical alternatives and rationale

- **Server-side localization:** rejected for this Work because the API contract remains locale-independent and translation presentation belongs to the Web UI.
- **Save rendered strings in state and retranslate by a side-effect on locale change:** avoid; stale copy and accidental repeated requests are easier to introduce.
- **Render-time resolution of stable error identity (selected):** small, testable, compatible with existing i18next and stable API codes, and supports existing-visible-feedback retranslation.
- **Global error framework/provider:** unnecessary and risks coupling unrelated bounded contexts and rendering surfaces. Use limited shared Web presentation logic.

These are local design trade-offs within existing architecture. **No ADR** is triggered.

## 8. Risks, boundaries, and delivery plan

- **R1 — #142 dependency:** Zod 4/resolver defect means interactive invalid-field behavior may be unreliable until #142 is integrated. Carry to Implementation and final validation; do not fold #142 into this Work.
- **R2 — Existing UI coverage:** several components use distinct feedback state shapes and some have no rendered error at all. Developer must enumerate present error surfaces and avoid assuming every mutation needs a new UI workflow; carry to Functional Compliance Review.
- **R3 — Testing infrastructure:** no installed DOM-based browser interaction harness is declared; adopt the smallest necessary test dependency/fixture if interactive feedback cannot otherwise be verified, and report it as validation evidence.
- **R4 — Security-sensitive error mapping:** operation-specific distinctions must preserve anti-enumeration, recovery masking and technical-failure policy. Carry to security-focused review and negative tests.

**Task Planning decision:** A single integrated Web presentation change on one Work branch and PR, with one competent Developer and no externally imposed delegation or independent sequencing, is presently an adequately bounded execution unit. Therefore no separate GitHub Sub-issues are required **at this time**; Developer may plan local implementation order without establishing another operational Task owner. If parallel delegation, substantive independent sequencing or separate acceptance boundaries arise, re-evaluate Task Planning under the delivery profile before proceeding.

**Suggested implementation order, not new Tasks:** establish safe local mapping/translation key coverage -> migrate existing sign-in/sign-up and recovery feedback -> migrate remaining existing Web error surfaces and verification flow -> targeted locale/security/accessibility tests -> applicable reviews/validation. #142 integration is a dependency for final field-error interaction evidence, not automatic authority to change its code.

**Unresolved upstream decisions:** none identified within this design's authorized functional scope. The user has approved Option B; no new product behavior or durable architecture decision is required. Developer escalates any conflicting feature-specific security/disclosure requirement to its owning Functional Specification rather than inventing a policy.

**State separation:** This Technical Design is the Work #144 intended implementation target. It is not a claim about `main`, deployed UI behavior, or validation completion.
