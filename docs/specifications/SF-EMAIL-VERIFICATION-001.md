# Explicit email verification confirmation

> **Identifier:** SF-EMAIL-VERIFICATION-001
>
> **Artifact status:** Approved
>
> **Content status:** Approved Target (Work #152; not effective Current Truth)
>
> **Document type:** Functional Specification
>
> **Domain:** Identity and Access Management / Email verification

## Work / authority context

**Work Type:** Product Behavior Change

**Workflow Depth:** Complex (security-sensitive, cross-component, intentional breaking HTTP-contract change)

**Approval:** **Human Functional Approval — Option B**, explicitly given by the Architecture Web maintainer in the conversation and recorded in [Work #145](https://github.com/Oxelio/architecture-web/issues/145#issuecomment-6963487710). That GitHub comment is an AI transcription of the human's express decision, not a separate human GitHub review.

**Owning Work:** [#152 — Require explicit confirmation for secure email verification via POST](https://github.com/Oxelio/architecture-web/issues/152)

**Originating security defect:** [#145 — Redact IAM verification tokens and sensitive credentials from HTTP logs](https://github.com/Oxelio/architecture-web/issues/145). Work #145 independently owns general server HTTP-log confidentiality and remains open.

**Existing functional dependencies:** [Security audit](SF-SECURITY-AUDIT-001.md) and [Account recovery](SF-ACCOUNT-RECOVERY-001.md) own adjacent security requirements; this specification does not replace or expand their functional scope.

**Authority distinction:** This is an **Approved Target** for the identified Work scope. It is not proof that the behavior is effective on `main` or implemented, reviewed or validated.

## 1. Business context / problem

A user must prove control of the email address supplied for an IAM login identity. The current HTTP flow automatically validates and consumes an emailed single-use token when the verification page loads, and passes that token in request URL query strings. Query-bearing URLs can be captured in HTTP request, access and error logs; automatic page-load verification can also be triggered by link scanning or preview clients capable of executing the page.

The intended verification should follow an explicit user action, rather than the side effect of opening or inspecting an emailed link, and avoid sending newly issued tokens in the browser's HTTP navigation URL or the API request URL.

## 2. Functional objective

Allow the recipient of a verification email to open a safe, understandable confirmation page and **explicitly confirm** verification. The application then validates and consumes the existing single-use verification token, with clear success or safe failure feedback, preserving IAM token validity and account semantics.

## 3. Actors and authorization

- **Recipient:** the person able to access the verification link delivered to an email address. A session or prior sign-in is not required by the existing public verification flow.
- **Email security scanners / link preview clients:** may request or inspect a link; **opening/inspecting the link is not authorization to consume the token**.
- **IAM service:** validates the token and applies the existing email identity verification rules; an invalid or expired token cannot verify an account.

This feature does not make possession of a link equivalent to an authenticated session and does not sign the recipient in automatically.

## 4. Scope and non-goals

**Approved scope:** The new verification email link, React verification-page interaction, the Web-to-API verification request and associated safe feedback.

**Non-goals:**
- Change verification-token generation, hashing, expiry rules, single-use semantics, or identity ownership.
- Change sign-up policy, resend eligibility or rate limits, session authentication or other IAM application/domain rules.
- Add a generalized email-link, recovery or deletion workflow.
- Treat POST/request-body transport as sufficient protection against logging leaks: Work #145 separately safeguards the HTTP logging sinks.
- Rework the IAM bounded context or establish a new general architecture policy.

## 5. Functional rules and invariants

1. **New email link:** Newly issued verification emails direct the recipient to the Web verification page with the token in the URL **fragment** (`/verify#token=...`). The fragment is not sent as part of the HTTP navigation request.
2. **Page load is inert:** Navigating to, previewing, refreshing or rendering the verification page **MUST NOT** by itself submit a verification request or consume the token, including during normal React mount, remount and language changes.
3. **Explicit confirmation:** When a token is available, the page presents a clear action such as **“Confirm my email address”**. Verification occurs **only** after the user intentionally activates that action.
4. **API verification request:** The Web submits the token in the **JSON body** of **`POST /v1/iam/verify`**. The token MUST NOT be placed in the API request URL, query string or path.
5. **Token handling:** The Web minimizes token exposure in the browser address bar by promptly removing the token-bearing fragment after extracting the value. The token is not placed in browser persistent/session storage or diagnostic/telemetry output. An in-memory representation is acceptable until submission/navigation.
6. **One-time semantics:** The existing IAM rules for validity, expiration, hashing, invalidation, identity binding and atomic single use remain authoritative and unchanged. Only an accepted verification attempt marks the email identity verified.
7. **No automatic retry:** An in-flight submission cannot trigger duplicate user actions or silent repeated verification requests on React render/remount/language change. The backend remains authoritative for concurrency and one-time consumption, even if duplicate requests occur.
8. **No implicit authentication:** Success verifies the intended email identity; it does not automatically sign in, elevate privileges, or alter unrelated session behavior.
9. **Clean breaking replacement:** The old `GET /v1/iam/verify?token=...` API route and Web query-token parsing are **removed**. No legacy fallback, dual endpoint, transition window or compatibility route is required. The maintainer explicitly accepts that already-issued verification links may become unusable because this project is not in production. The new POST/fragment flow is the only supported target.

## 6. States and significant transitions

- **No token / unusable link:** Display a safe invalid-link or missing-link result; do not send a verification request.
- **Token available / awaiting confirmation:** Show the explicit confirmation action. Email remains unverified by page load alone.
- **Submitting:** Show progress and prevent accidental duplicate activation; the result is not assumed before the server response.
- **Verified:** Display a successful confirmation and an appropriate next action, such as signing in.
- **Invalid, expired, previously consumed or otherwise rejected:** Display understandable, safe failure feedback and an appropriate existing next step, without disclosing sensitive account existence or token information.
- **Technical/network failure:** Do not silently claim success or automatically consume/retry; display a generic technical failure and an explicit recovery/retry path consistent with one-time token uncertainty.

State management and transport controls must not reinterpret unexpected technical failures as valid business outcomes.

## 7. Functional dependencies and interactions

- Verification emails continue to use the existing IAM email-delivery capability.
- The React Web app hosts the landing/confirmation view.
- The IAM API accepts the explicit verification submission and delegates to the existing verification application contract.
- The existing IAM business verification logic and token persistence remain unchanged.
- General sensitive-credential logging is owned by Work #145 and its technical controls; localized user-facing error text may be coordinated with Work #144 without changing the functional outcome.

## 8. Observable behavior / UX expectations

The recipient opens an email, visits the verification page and sees a comprehensible explanation of the pending action and an explicit confirmation control. **No progress from pending to verified happens on passive page inspection.** After activation, the UI presents a pending state, followed by confirmation or a safe error state.

The page must remain usable under the supported locales and established accessibility expectations. Exact wording, visual styling and component composition are not new product requirements of this approval.

## 9. Errors, edge cases and failure behavior

- Missing/malformed token: no POST; safe feedback.
- Expired/invalid/already-used token: cannot verify again; no secret-bearing error details; clear next step.
- Multiple clicks, re-renders, StrictMode, locale switching: no automatic second submission. The backend's existing atomic token-consumption rule remains the final safeguard.
- Network interruption or ambiguous server response: no unsupported assumption that the token was or was not consumed; avoid background retries. Offer a clear next step.
- Browser link previews, email scanners, redirect/rewrite clients: mere page opening is non-mutating. This protects against passive or JavaScript-running scanners that do **not** simulate the explicit user action; it is not a claim of safety from scanners that actively click controls.
- Already-issued `?token=...` links and old GET API clients: explicitly unsupported after this authorized breaking change, with **no** compatibility fallback. The UI should not send a verification request if a link contains no valid fragment token.

## 10. Security and privacy requirements

- A newly issued verification token is a usable credential and must not be included in HTTP navigation/request URLs, server access/error logs, application/request/response diagnostics, client telemetry or persistent browser storage.
- The Web should promptly remove the token fragment from the visible URL and not expose the token to unrelated third-party code on the confirmation page.
- POST request bodies and exception handling must not be captured verbatim in HTTP logs. Work #145 owns the broader safe-logging implementation and validation; this specification does not imply that merely using POST automatically prevents logging leaks.
- Preserve existing TLS deployment requirements, token validity/expiration/single-use rules and authorization/anti-enumeration policies. No new token secrets may be exposed by success/failure feedback.

## 11. Functional alternatives considered

- **A — Query link + POST body:** rejected. The emailed-link navigation still sends `?token=...` to HTTP intermediaries and logs, even though the API itself uses POST.
- **B — Fragment link + explicit user confirmation + POST body:** **approved**. Keeps passive navigation non-mutating and reduces direct HTTP URL disclosure of new verification tokens.
- **C — Fragment link + automatic POST during React page load:** rejected. Security scanners that execute the page's JavaScript may consume the token without the user's intentional confirmation; StrictMode or rendering changes create additional accidental-repeat exposure.
- **Disable logging only on verification route:** rejected as insufficient to address broader credential-bearing HTTP logs; handled independently by Work #145.
- **General IAM verification architecture redesign:** rejected as disproportionate to this scoped behavior change.

## 12. Open functional decisions

**None within the human-approved Option B behavior and its subsequent explicit no-legacy decision.** The maintainer separately authorized removing the old GET/query contract without compatibility or a transition window ([Work #152 decision](https://github.com/Oxelio/architecture-web/issues/152#issuecomment-6963876703)). Browser/email-client verification coverage and UI copy/accessibility details belong to Technical Design and implementation as long as they preserve the above behavior. Any proposal to remove explicit confirmation, introduce automatic verification or change identity/token policy returns to the functional owner.

## 13. Acceptance criteria

- [ ] New email verification links carry the token in a fragment, not a navigation query.
- [ ] Visiting, refreshing, previewing, mounting or switching locale on the verification page does **not** verify the email.
- [ ] A visible, accessible, explicit user confirmation triggers verification through POST with the token in a JSON body and no token in the API URL.
- [ ] The UI shows meaningful pending/success/invalid/expired/technical outcomes without leaking tokens or account existence details.
- [ ] Existing IAM validity, hashing, atomic consumption, identity binding and session behavior are preserved.
- [ ] No silent retries/duplicate actions or use of persistent browser storage for the token.
- [ ] The legacy GET verification endpoint and Web query-token fallback are **removed**, with no transition window. Already-issued query-only links are intentionally unsupported. Representative email/client scanning and fragment-rewriting behaviors are tested for the new flow.
- [ ] Targeted API/Web/security tests show no token leakage in identified network URL, application logs or error diagnostics; Work #145's general logging obligations remain separate.
- [ ] Candidate-specific Code, Architecture, Functional Compliance, Security/Privacy Reviews and Validation evidence meet project gates.

## 14. Human approval

**Decision:** **Approved — Option B** (2026-11-17).

**Approved scope:** Email link with verification token in URL fragment; Web landing page with no passive/automatic verification; explicit manual confirmation; POST verification token in JSON body; preservation of one-time IAM business semantics and safe feedback, without a logging/architecture redesign. A **subsequent explicit human scope decision** approves dropping the legacy GET/query contract without preserving already-issued links; [decision record](https://github.com/Oxelio/architecture-web/issues/152#issuecomment-6963876703).

**Authority / record:** The human Architecture Web maintainer explicitly approved Option B, recorded in [Issue #145 comment 6963487710](https://github.com/Oxelio/architecture-web/issues/145#issuecomment-6963487710), and subsequently expressly accepted breaking compatibility with no legacy support, recorded in [Issue #152 comment 6963876703](https://github.com/Oxelio/architecture-web/issues/152#issuecomment-6963876703). These are AI transcriptions of actual ChatGPT user decisions, **not direct human GitHub PR reviews**. No implied approval for code implementation, reviews, merge, deployment, broader token flows or Nginx logging policies.

**Maturity:** Approved Target for Work #152 only, not Current Truth. Effective behavior and current-state documentation must not be changed until an appropriately authorized and validated implementation is integrated.
