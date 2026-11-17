# Technical Design — Explicit email verification over POST

> **Identifier:** TD-EMAIL-VERIFICATION-001
>
> **Artifact status:** Prepared for implementation
>
> **Content status:** Proposed Target (Work #152; not effective Current Truth)
>
> **Document type:** Technical Design
>
> **Domain:** IAM HTTP and email adapters / Web confirmation UX

## Work / authority context

- **Work:** [#152 — Explicit email verification confirmation](https://github.com/Oxelio/architecture-web/issues/152), Product Behavior Change / Complex; security-sensitive, cross-component and HTTP-compatibility sensitive.
- **Approved Functional Specification:** [SF-EMAIL-VERIFICATION-001](../specifications/SF-EMAIL-VERIFICATION-001.md) — approved Option B only. The maintainer's recorded [explicit human approval](https://github.com/Oxelio/architecture-web/issues/145#issuecomment-6963487710) is an AI transcription of the user decision, not direct GitHub review.
- **Related security correction:** [#145](https://github.com/Oxelio/architecture-web/issues/145), Defect Correction / Complex, independently owns safe Fastify and Nginx access/error logs; **NOT READY** at the last review because of native Nginx error logs.
- **Architecture:** [Project principles](../project/architecture-principles.md), [current overview](../architecture/overview.md), [dependency rules](../architecture/dependency-rules.md), [HTTP reference](../reference/http-api.md).
- **Validation / delivery:** [Testing](../development/testing.md), [delivery](../project/delivery-pipeline.md).

## 1. Behavior and invariants to preserve

The approved functional target requires a **fragment token** in new verification email links, an **inert landing page**, an **explicit user confirmation control**, and an unauthenticated **POST body** verification request. Existing IAM token hashing, expiry, invalidation, atomic single use, identity binding, response security and no automatic sign-in remain unchanged. The developer may choose local implementation details but **must not introduce automatic verification on mount or change token business rules**.

This target does **not** establish a general token transport, email authentication, React or ingress policy for other routes. The underlying logging correction remains a separate Work.

## 2. Boundary ownership

- **IAM domain/application:** Existing `VerifyEmailUseCase`, token value object, hashing port and persistence adapters remain unchanged; no new domain ports or application services.
- **Email adapter:** `packages/adapters/iam/email-nodemailer/src/nodemailer-email-sender.adapter.ts` owns construction of new external Web links.
- **API HTTP adapter:** `apps/api/src/features/iam/routes/public.routes.ts`, `verify-email.route-options.ts`, `verify-email.controller.ts` own HTTP method and body schema. Existing `verify-email.http.ts` presenter/business error mapping remains authoritative.
- **Web UI:** `apps/web/src/pages/VerifyEmailPage.tsx` owns the landing, explicit confirmation and presentational states. `apps/web/src/services/api.ts` owns POST transport. `apps/web/src/main.tsx` enables `StrictMode`; i18next translations already exist for the verification page.
- **HTTP logging:** Work #145 owns generic Fastify/Pino, Web Nginx and diagnostic sink corrections. Work #152 may add focused no-secret assertions for the new POST without redefining #145's technical plan.

## 3. Flow / interfaces

### New email link

Build a URL from the configured `SMTP_VERIFY_URL`. Put token data in the **fragment**, for example `https://app.example/verify#token=<percent-encoded-token>`. Use appropriate URL fragment encoding; do not insert a fragment token into a query or path. Preserve the configured Web landing path, and test both HTML and plain-text email links.

**Email-client compatibility:** Some link-protection systems rewrite URLs. Verify with representative clients and realistic link wrapping that the fragment survives and that opening a preview remains non-mutating. If this breaks an important supported client, report a functional/compatibility problem to the proper owner instead of silently restoring query-token links as the long-term design.

### Web landing and confirmation

The existing `BrowserRouter` at `/verify` remains. Parse the `token` key from the fragment's URLSearchParams representation (e.g. `#token=...`); don't confuse the fragment with routing (`HashRouter` is not installed). After capture into component-local memory, remove the sensitive fragment using a **replace**, not a push to browser history. Do not persist it in cookies, `localStorage`, `sessionStorage`, analytics, URL query or global application state.

**Opening the page MUST do nothing that verifies an email.** Any effect necessary for token capture/URL scrubbing must be idempotent and non-mutating with respect to IAM. In particular, do **not** call the API from an effect, translation callback, React render, mount/remount or a retrying query hook.

Render a clear pending confirmation UI with a button. The actual button handler submits once per user activation and disables repeated activation while pending. State is explicit (`missing`/`awaiting_confirmation`/`submitting`/`success`/`error`); client code keeps structured outcome identity, not translated strings, so a locale change re-renders feedback without resubmitting. Show existing appropriate next steps after success or failure. Avoid a retry that assumes a previous ambiguous server response did not consume a single-use token.

### API request and controller

The Web API client sends:

```http
POST /v1/iam/verify
Content-Type: application/json

{"token":"<SYNTHETIC_EXAMPLE>"}
```

The HTTP route changes to POST with a strict `Body` TypeBox schema for a nonempty token; controller obtains `request.body.token` rather than `request.query.token` and delegates to the **existing** `VerifyEmailUseCase`. Preserve the current success `204` and existing expected business-error response mapping. Validation errors use the established HTTP envelope; unexpected errors remain technical failures rather than business results. The endpoint remains public and does not authenticate/sign-in the user.

**No token in URL, logs or error text:** Validation/exception logging must not include raw payloads. The HTTP handler must not log `request.body` or a token-containing error. Tests must capture production-equivalent Fastify logging; a unit test instance with `logger: false` cannot establish safety of production logs.

## 4. Compatibility and rollout

The current email sender builds `/verify?token=...`. Both initial sign-up and resend generate tokens that expire **24 hours** after issue in the existing application code. No authorized token expiry policy change is part of #152. Already-issued URLs can therefore remain usable across deployment.

**Selected bounded transition:**
1. First make sure Web Nginx and API can safely handle legacy query-bearing requests without recording the credential: coordinate with Work #145 (particularly access/**error** log behavior). This protection must precede or accompany enabling any compatibility path that continues to process legacy URLs. Do not falsely assume raw legacy requests are safe just because React scrubs the URL afterward.
2. In the new Web UI, temporarily recognize `?token=...` links **only to recover already issued verification tokens**; immediately remove the parameter from the visible URL. Submit through the **new POST body path only after explicit manual confirmation**. Newly issued emails must use fragments, not query tokens.
3. To avoid silently breaking any non-Web HTTP clients, assess actual use of the documented `GET /v1/iam/verify?token=...` contract. Prefer a bounded compatibility/deprecation window if necessary, but do not keep an unsafe secret-in-URL endpoint indefinitely as the normal API design. A breaking contract decision with unestablished external consumers must return to the proper owner; it is not an implicit Developer choice.
4. Maintain old link compatibility **for at least the remaining validity period** of the last query-bearing verification emails issued (currently 24h), considering actual rollout overlap and possible older running instances. Use deployment evidence to establish the cutoff before removing legacy parsing/GET compatibility; if unknown, preserve the safe fallback until the owner resolves it.
5. Update the HTTP reference only when the change is effective on `main`, clearly distinguishing any deprecated overlap. Do not rewrite current architecture/reference as if the target already ran.

**Interaction with #145:** Fragment links eliminate new verification tokens from normal Web navigation URLs, and POST eliminates them from new API request URLs, reducing one exposure class. They **do not** secure Nginx error messages from legacy/recovery/deletion links, and do **not** prevent a logger from copying JSON bodies. #145 retains its Nginx blocker and its broader logs acceptance criteria.

## 5. Failure, concurrency and security

The existing use case uses token-hash lookup, expiry checks and transactional atomic consumption. This remains authoritative against double submission and concurrent requests. A duplicate request may properly fail after one successful consumption; present it as a recoverable UI state without falsely promising another success.

No verification on passive navigation, ordinary link scanning, React `StrictMode`, translations, hydration/re-render or component remount. An advanced scanner that deliberately clicks the confirmation button is outside the passive-scan guarantee; do not market manual confirmation as cryptographic identity proof.

Handle invalid or missing fragment, invalid/expired/consumed token, 400 validation, technical 500, lost response and network errors without showing token contents. A pending verification may have committed even if the response is lost; no blind automatic resend/retry. Keep error handling and anti-enumeration aligned with existing IAM behavior. Where UX strings change, use existing fr/en i18next conventions and coordinate with [#144](https://github.com/Oxelio/architecture-web/issues/144), but this Work owns its required explicit-confirmation labels and states.

Keep sensitive values out of browser persistent storage; avoid inadvertent third-party telemetry, referrer leakage (especially during legacy query compatibility) and arbitrary error logging. Confirm appropriate response cache and referrer settings for the page and API. A fragment is not sent as part of HTTP navigation, but can still be read by JavaScript and can be mishandled by email link rewriting; its use is defense-in-depth, not a substitute for token confidentiality in logs.

## 6. Trade-offs and ADR

- **Query link + POST:** insufficient against Web ingress URL logs.
- **Fragment + automatic POST:** violates explicit user-intent invariant, scanner risk.
- **Fragment + manual POST (approved):** one extra action but robust against passive/link-executing preview clients that do not simulate the click; no new domain framework or persistence.
- **Replace HTTP identity-verification logic:** unnecessary; domain/application already handles one-time semantics.

No new **durable structural architecture** rule or meaningful structural alternative requires an ADR. This is a focused product-flow/transport target with an existing architecture.

## 7. Validation plan

1. **Email adapter tests:** assert new message HTML and text contain encoded `#token=...`, never `?token=...`; preserve configured path/other non-secret URL information where applicable.
2. **API route and controller tests:** `POST /v1/iam/verify` body schema; successful `204`; invalid/expired/consumed token mappings; no accidental authentication change; no bare token in URL, logs or errors. Check compatibility GET behavior according to the established rollout.
3. **React verification flow tests:** no call on page navigation, rerender, `StrictMode` or locale switch; token scrubbing; explicit button sends only POST once; pending/button disabled, success/error/missing/expired states; no token in browser storage or console diagnostics.
4. **Link scanning test:** fetch/load the Web verification page with the fragment (including JS execution where test harness permits) **without clicking the action**; assert zero verification requests and no token consumption.
5. **Legacy query compatibility:** synthetic old `?token=...` Web link, URL cleanup before user action, manual POST, and absence of token in **all** repository-controlled ingress/error logs; require actual Nginx runtime checks coordinated with Work #145.
6. **Security/operations:** test representative link rewriters and browser navigation. Validate new POST body is not emitted by Fastify/Pino, audit, error handlers or any known proxy sink. Do not use live tokens.
7. **Full evidence:** `pnpm --filter web test`, `pnpm --filter api test`, affected email-adapter/IAM suite, typecheck, lint, build and candidate-bound CI. Separate Code Review, Architecture Review, Functional Compliance Review and focused Security/Privacy Review. Source review is not execution evidence.

No full browser E2E suite is currently declared; the Developer may use a bounded DOM/component harness or equivalent minimal test setup, plus the Nginx runtime tests necessary for the logging boundary. Explicitly report skipped evidence rather than claiming comprehensive coverage.

## 8. Tasks, risks and handoff

**Task Planning:** recommended two independently verifiable execution units within this single Work/PR: (1) email adapter and API HTTP migration/compatibility contract; (2) Web fragment/manual-confirmation flow and related tests. Integrate both before cross-boundary verification. No independent Project Work state for the tasks.

**Risk R1 — legacy token leakage / operational gate:** Already issued query links may be requested before the client can scrub them. Coordinating with #145's safe logging is mandatory for full security acceptance; unverified Nginx error sinks remain a blocker for claiming complete log safety on those paths.

**Risk R2 — HTTP GET client compatibility:** The API GET route is documented; usage by external non-Web clients is not established. Resolve removal/deprecation based on actual evidence or return to the functional/compatibility authority. No silent breaking change.

**Risk R3 — email rewrites:** Third-party link-safety products may alter URL fragments. Test supported clients; unresolved significant incompatibility routes to functional owner rather than fallback to automatic confirmation.

**Risk R4 — token exposure in Web bootstrapping/telemetry:** Capture/cleanup occurs in a client-side SPA, so other scripts may briefly observe fragments; implementation should minimize the interval and avoid unrelated third-party scripts. Threat model and executable verification are necessary.

**Risk R5 — test evidence:** No runtime/browser/email-client/Nginx tests have been run yet. Do not mark implementation or validation complete based on this Technical Design.

**Target/effective distinction:** This document is a proposed technical target under an **Approved Functional Specification**, not current implementation truth. No code changed and no executing agent/merge authorized by this document.
