# Technical Design — Confidential HTTP request logging

> **Identifier:** TD-HTTP-LOG-REDACTION-001
>
> **Artifact status:** Prepared for implementation — mandatory pinned-image security validation pending
>
> **Content status:** Proposed Target (Work #145; not effective Current Truth)
>
> **Document type:** Technical Design
>
> **Domain:** HTTP ingress, Web serving and operational diagnostics

## Work / authority context

- **Work:** [#145 — Redact IAM verification tokens and sensitive credentials from HTTP logs](https://github.com/Oxelio/architecture-web/issues/145)
- **Related approved functional target (separate Work):** [#152 — Explicit manual email confirmation and POST verification](https://github.com/Oxelio/architecture-web/issues/152), [Approved Target SF-EMAIL-VERIFICATION-001](https://github.com/Oxelio/architecture-web/blob/work/152-explicit-email-verification/docs/specifications/SF-EMAIL-VERIFICATION-001.md). Its new fragment-link/POST behavior is **approved for #152**, not currently implemented and **not a change authorized inside Defect Correction #145**. Both Works must preserve their independent owners and readiness gates.
- **Work Type / Workflow Depth:** Defect Correction / Complex
- **Change Characteristics:** security-sensitive and cross-system (`apps/api` plus Web Nginx)
- **Exploration:** [Work #145 findings](https://github.com/Oxelio/architecture-web/issues/145#issuecomment-6962784839)
- **Human-approved target / rationale:** [2026-11-18 security and IAM-fragment decision](https://github.com/Oxelio/architecture-web/issues/145#issuecomment-6965227785); separate functional ownership is preserved for verification (#152), recovery and deletion cancellation.
- **Readiness positioning:** The selected design can be implemented with an explicit fail-closed candidate-bound test gate; the pinned Nginx image proof belongs to implementation/validation, not to approval of the technical choice. This does not claim proven safety.
- **Authoritative expected behavior:** [SF-ACCOUNT-RECOVERY-001](../specifications/SF-ACCOUNT-RECOVERY-001.md) (no usable tokens in logs), [SF-SECURITY-AUDIT-001](../specifications/SF-SECURITY-AUDIT-001.md) (no credentials in audit), [SF-PASSWORD-001](../specifications/SF-PASSWORD-001.md) (no password logging), [SF-ACCOUNT-DATA-001](../specifications/SF-ACCOUNT-DATA-001.md) (cancellation token confidentiality), and [SF-SESSION-001](../specifications/SF-SESSION-001.md). Existing business behavior is unchanged; no new Functional Specification or Functional Approval is required.
- **Architecture and delivery:** [Architecture principles](../project/architecture-principles.md), [overview](../architecture/overview.md), [dependency rules](../architecture/dependency-rules.md), [testing and verification](../development/testing.md), [delivery profile](../project/delivery-pipeline.md).
- **Observed code/configuration:** `apps/api/src/server.ts`, `types/error-handler.ts`, `helpers/register-http-audit.ts`, related HTTP tests, `apps/web/nginx.conf`, `apps/web/Dockerfile`, `docker-compose.yml`, and Web verification/recovery/deletion-cancellation links.
- **Decision authority:** Bounded technical corrections by the Software Architect role within existing HTTP/infrastructure ownership. This does not establish a new project-wide architecture rule or amend a functional owner.

## 1. Scope and invariant

Prevent **usable credentials** from being emitted to **repository-controlled HTTP request/access/error log sinks**. **Current Truth** on `main`: Web links contain `?token=...` for verification, recovery and deletion cancellation, and the API currently exposes GET `/v1/iam/verify?token=...`. **Approved Target** for separate IAM work: fragment-based email links for all three flows, verification user confirmation + POST body (Work #152), existing POST body APIs for recovery/cancellation. The maintainer explicitly authorized dropping verification's GET/query contract without legacy support; #145 must **not** require preserving that deprecated target API. Credential classes in this logging Work include verification, recovery and cancellation tokens, session cookies, Authorization values, passwords, MFA/TOTP and backup codes when present in logged HTTP data.

This is _not_ a broad IAM refactor, new logging retention policy, change to token transport/business API, or expansion into unverified external infrastructure. Keep stable response and error contracts, session flows, HTTP authorization, domain/application layers, and security Audit semantics. Closed #49 separately owns the prior session bearer credential representation change. A broken/degraded logging sink must not turn an otherwise successful business response into a new business failure.

## 2. Observed logging paths and ownership

### Fastify/Pino (API)

`buildServer` currently enables `logger: true`; automatic request logging serializes a request URL that may include sensitive query data. The shared `errorHandler` also logs the full `Error` object. Framework 404s and schema/validation failures require their own negative tests. The Audit onResponse hook already records route **templates** rather than concrete identifiers, and it is **not** the source of the observed normal Fastify request line. Its audit-write-failure diagnostic currently logs an `err` object, which must be reviewed for secret-bearing messages.

**Selected local correction:** Configure Fastify's production logging **at initialization**, before it handles requests. Suppress unsafe **automatic** request lines (Fastify supports `disableRequestLogging`) and replace them with bounded, structured request-completion diagnostics that contain only allowlisted metadata (HTTP method, matched **route template**, request/correlation ID, status and elapsed duration if available). Unknown/unmatched routes get a constant marker such as `[unmatched]`, **never the incoming URL, path, headers, parameters or body**. Include no full request/reply objects by default. If the logger receives an explicit `req` object elsewhere, use a conservative request serializer that does not expose raw URLs, query parameters or headers.

Review all **currently identified** error log paths (global error handler, Fastify default failure handling, HTTP audit-write failure). Emit safe classifications/identifiers rather than raw arbitrary `error.message`, `Error.stack`, `err` or validation payload if these can include user-supplied secrets. Keep useful safe diagnostics, including request ID and technical error category; do not blanket-disable operational logging or convert technical failures into success. Preserve existing HTTP response contracts.

**Important:** A Pino `redact` path targeting `req.query.token` alone is insufficient if a stringified request URL has already been serialized into `req.url`. Capture/serializer-level prevention is preferred. Also verify early failure hooks, 404s and startup diagnostics rather than assuming every log goes through the successful matched-route lifecycle.

### Web Nginx (configured application reverse proxy and SPA server)

`apps/web/nginx.conf` currently uses `access_log /tmp/nginx_access.log;` without a safe format. Nginx defaults to the **combined** format, whose request line contains URL and query; browser token-bearing links therefore present an additional concrete log-exposure path.

**Selected Nginx production correction (human-approved target):**

- Use a native **JSON access log to container stdout** containing only allowlisted safe operational metadata: timestamp, Nginx request ID, a bounded nonsecret request group (e.g. static `web`/`api` classification), status, method **from an explicit HTTP verb allowlist if needed**, total request time, upstream status/connect/response time when available. Use `log_format ... escape=json`. No raw URL, path, query string, referrer, Authorization header, cookie, body, request line or arbitrary client-controlled field. Avoid directly logging `$uri`, `$request`, `$request_uri`, `$args`, `$query_string`, `$http_referer` or `$http_authorization`. Nonstandard methods should map to a safe constant rather than echo attacker-supplied bytes.
- Nginx's native **request-associated error log is a separate sink that cannot be sanitized via `log_format`**. Suppress these HTTP-scoped messages (`http { error_log /dev/null error; }`) while retaining a **main-scope process diagnostic sink** (`error_log /dev/stderr warn;`) **only if early-parse/process paths are shown not to emit usable request secrets**. Nginx inheritance and request-processing stages must be tested in the actual pinned image. If main-scope output still contains canaries, the target is not safe and needs an explicit amended strategy.
- Preserve safe request/outcome diagnostics via access records, upstream timings and Fastify's separate safe error categories. Prefer a **single production-safe configuration also used in local development**. If detailed Nginx error traces are needed for a rare incident, enable them temporarily in an isolated diagnostic setup with synthetic data, rather than automatically writing real tokens in development. Do not introduce a generic log processor, regex redactor or duplicate full dev/prod configuration by default.

**Proposed bounded Nginx shape (must be tested on the repository's pinned 1.31.3 image):**

```nginx
error_log /dev/stderr warn;

events {
    worker_connections 1024;
}
http {
    error_log /dev/null error;
    map $uri $request_group {
        default web;
        ~^/api/ api;
    }
    map $request_method $safe_method {
        default OTHER;
        GET GET;
        HEAD HEAD;
        POST POST;
        PUT PUT;
        PATCH PATCH;
        DELETE DELETE;
        OPTIONS OPTIONS;
    }
    log_format safe_access escape=json
        '{"time":"$time_iso8601","request_id":"$request_id",'
        '"group":"$request_group","method":"$safe_method",'
        '"status":"$status","duration":"$request_time",'
        '"upstream_status":"$upstream_status",'
        '"upstream_connect_time":"$upstream_connect_time",'
        '"upstream_response_time":"$upstream_response_time"}';
    access_log /dev/stdout safe_access;
    # Keep existing MIME, SPA, proxy, runtime and server directives.
}
```

**Proof status and gate:** Earlier synthetic PoC in the analysis environment on Nginx **1.26.3** observed unsafe request lines under regular error logging and no canary in the tested suppress-HTTP-error configuration. That is **not** repository-image 1.31.3, full early-error coverage, or deployment evidence. This remaining evidence is a **mandatory Implementation/Security Review/Validation check rather than a prerequisite to starting implementation**, because the target and its fail-closed test procedure are now selected. Before passing security validation or merging, exercise missing assets, unavailable upstream, invalid/malformed/oversized requests and arbitrary URL canaries, inspecting **stdout, stderr, all configured files and inherited main-scope error paths**. A failed canary test forces a return to the architect, not a relaxation of the confidentiality objective. Do not claim token redaction from changing access log format alone.

### Other owners and external infrastructure

`registerHttpAudit` is a structured _security-event_ recorder with separate approved constraints; preserve its domain/application contract. This Work does not automatically rewrite Audit retention or credential schemas. Docker Compose declares API and Web Nginx, but **does not establish visibility into any deployed external proxy, platform ingress, log shipper, browser history or retained logs**. Document those boundaries for the operator-owned incident review instead of claiming protection for unknown infrastructure.

## 3. Data, state, correlation and diagnostic contract

No new persisted business fields or migrations. No new domain model, application port or cross-context events. Existing technical log records MAY add safe fields such as:

- `reqId` (existing per-request correlation identity);
- `method` (verified safe HTTP verb);
- `route` (Fastify matched route template or constant fallback);
- `statusCode`;
- `durationMs` when measured without exposing user data;
- `errorCategory`/known technical error code on failure, if sanitized and not sensitive.

Do not automatically log IP, user agent, unreviewed headers, subject identifier or arbitrary key/value fields. Keep existing Audit correlation behavior, without copying bearer data into log properties. Nginx and Fastify identifiers are not assumed to be the same request ID unless actual forwarding/correlation is established and tested. No security guarantee may depend solely on string-based post-processing or filtering a log file after it has been written.

## 4. Request and failure flows

1. HTTP entry: compute the minimal safe logging context from metadata controlled by the router/runtime.
2. Matched success or expected business failure: write a safe completion record with method, route **template**, request ID, status and duration. Do not change status or response body.
3. Invalid input, unhandled technical error, unmatched/404 request: preserve existing HTTP semantics; any request/error diagnostic records only safe metadata. Avoid logging arbitrary exception messages/stacks or concrete URLs.
4. Audit write failure: preserve its existing loss/error policy and emit a sanitized operational failure record. Do not log an unreviewed exception or make the HTTP response represent a different outcome.
5. Browser token link through Web Nginx: keep routing/SPA fallback and API proxy behavior unchanged; access-log metadata remains useful without URI/query/token. Verify Nginx error-path behavior separately.

Technical errors remain technical; an absent or unsafe logger cannot be converted into a normal domain outcome.

## 5. Security/privacy and historical exposure

Security testing must use **synthetic canary tokens** and fake credentials only, with markers never copied into permanent test snapshots or operational issue comments as live secrets. Test raw encoded/decoded query variants, credential-like path segments, headers, cookies and request bodies where the sink actually sees them. Assert safety on success and failure, not only on the happy path.

**Historical exposure is an operator responsibility:** promptly determine where the reported API logs and Nginx file/volume logs reside, whether production or shared environments were involved, who could read/ship them, retention and backup policies, and whether still-valid tokens need expiration, rotation or revocation by an authorized maintainer. Existing logs may remain sensitive even after a code/configuration patch. Do not publish log samples or copy tokens into GitHub/PRs. Legal/security incident response is not inferred and has not been carried out by this design. Record decisions and evidence in access-controlled operator channels, without leaking credentials.

## 6. Compatibility, performance and rollout

Preserve Web routes, API version, authentication behavior, CORS, Fastify request IDs, authorization semantics, response status/body, security Audit and existing request performance characteristics. No schema change, database migration, cache invalidation or client API change is planned.

Minimal structured records should reduce log volume. Use the existing Fastify/Pino logger and Nginx native configuration; no new external logging platform, proxy or global wrapper framework. Assess the operational impact of suppressing default Fastify request lines and changing Nginx log format; update affected monitoring/parsers only if actually present. Preserve error and status observability sufficiently for debugging and incident triage.

## 7. Validation strategy and acceptance evidence

**API (Fastify):**

- Use an in-memory captured logging stream in targeted Vitest/Fastify `inject` tests with **production-equivalent logger initialization**; avoid relying solely on arbitrary test instances where logging is disabled by default.
- Exercise synthetic token-bearing HTTP requests on both current GET/query and approved new POST/body verification shapes as appropriate to the tested code candidate (without preserving the GET compatibility route). Cover success, invalid/expired token, schema-invalid body, unexpected exception and 404/unmatched query. Assert the raw fake token, its encoded form and sensitive headers/cookies/body/error strings are absent from **every emitted log record**.
- Verify useful metadata is still present (method, safe template or fallback, status, request ID and duration if available) and that HTTP responses stay unchanged.
- Cover global `errorHandler` and audit-write error logging with fake secret-bearing exception text to prove safe handling; ensure no real secret is used.

**Web Nginx:**

- Validate Nginx configuration syntax using the actual built image or compatible Nginx runtime (`nginx -t`).
- Send synthetic token-bearing browser routes (`/verify`, `/recovery`, `/cancel-deletion`), proxy requests (including failure and unavailable API), unmatched routes and deliberately failing assets.
- Inspect all actual Nginx log destinations on the tested candidate, including Docker **stdout/stderr**, any legacy files and main-scope/inherited process diagnostics. Verify zero canary tokens while JSON access metadata (status, group, timings, upstream and request ID) remains useful; confirm no request-associated error narrative is emitted.
- If Nginx error messages still include token-bearing raw request lines, **do not pass validation** or claim safety; escalate for a limited corrective change with the appropriate design owner.

**Cross-boundary / reviews:**

- Validate representative application statuses and authentication/session routes, safe Audit metadata and no secret leakage with `pnpm --filter api test`, focused typecheck/lint/build as applicable, and deployment-level Nginx inspection.
- Apply separate Code Review, Architecture Review for ingress/logging boundary, Functional Compliance Review (preserve existing IAM behavior) and **security/privacy-focused Review**.
- Record candidate commit SHA, CI/test run identity, exact commands, results, environment coverage and any skipped operational tests in Validation evidence. Passing unit tests alone do not certify deployment or historical log cleanup.

## 8. Alternatives and rationale

- **Only redact `token` query keys in Pino:** rejected as incomplete against arbitrary URI, other credential classes and Fastify error/404 paths.
- **Turn off all API/Nginx logs:** rejected; loses essential diagnostic, security response and correlation evidence.
- **Regex scrub emitted full strings after the fact:** rejected as fragile; secrets may already have been formatted or sent to a sink, and new forms evade filters.
- **Allowlisted Fastify error/request diagnostics + JSON Nginx access records (selected):** retain safe request IDs, status, route template (Fastify only), bounded group, duration and upstream timings without raw URL/body material.
- **Suppress HTTP-scoped native Nginx error text, preserve demonstrably safe process diagnostics (selected):** accepted loss of individual Nginx error narratives to avoid request-line leaks. Native Nginx has no supported error-log equivalent to `log_format`. Preserve observability through safe access/upstream diagnostics and the API logger.
- **Remove tokens from all three emailed URLs (approved target, separate functional owners):** the maintainer approved fragments for verification, recovery and deletion cancellation ([record](https://github.com/Oxelio/architecture-web/issues/145#issuecomment-6965227785)). #152 owns the verified-email behavior; existing recovery and deletion Functional Specifications own their product behavior. These changes are **not** implemented by #145 and do **not** replace the independent defense-in-depth logging fix.
- **New generalized logging infrastructure:** not required to correct the currently identified repository sinks.

No durable structural rule with contested alternatives is established by the selected bounded logging correction. **No ADR** is currently triggered.

## 9. Task plan and risks

**Task Planning triggered:** API/Fastify and Web Nginx are independently changeable, independently testable security boundaries. Create two GitHub Sub-issues under Work #145, each referencing this Technical Design and its upstream specifications. The tasks can proceed in parallel on the **single Work integration branch** but final cross-boundary security validation requires both completed. Do not add Task Sub-issues as independent Project Work items or assign an autonomous `agent:*` route without human assignment.

**Risks carried forward:**

- **R0 / Security-validation risk (Developer + Security Review / Validation):** The maintainer **selected** suppression of request-scoped Nginx native errors plus safe JSON access logs while retaining safe process errors. The **pinned-image proof is still missing**. The selected technical approach is sufficiently bounded to implement, and reproduction on Nginx 1.26.3 was only preliminary feasibility evidence, **not acceptance evidence**. In implementation and on the actual Nginx 1.31.3 image, test synthetic canaries across early parsing, main-scope inheritance, startup/reload and failure paths to stderr/stdout/file sinks. **This is a non-blocking Readiness risk but a strict security Validation/merge blocker:** if any sink emits a secret, validation must fail and the work must return to the Software Architect for redesign; no workaround is authorized by the Developer.
- **R1 / Implementation + Validation:** Test the selected Nginx error-log protection using synthetic failure paths and verify no canary token is emitted by access **or** error logging. Process/main-scope logging is included; failure returns to the Software Architect.
- **R2 / Fastify early failures:** the safe path must cover default 404, validation errors and errors outside ordinary successful request hooks. Developer validates against the exact Fastify runtime/version in this repository.
- **R3 / Historical logs:** no access to deployed log retention/aggregation and no verified evidence of the extent of past disclosure. Operator performs separate immediate scope, containment and rotation assessment; changes cannot retroactively purge copies.
- **R4 / Monitoring:** changed log shape may affect consumers of raw URLs. Verify actual log consumers during implementation/operations; no consumer is assumed present or absent.
- **R5 / Evidence:** static analysis only thus far; no Docker runtime reproduction or executed tests. Candidate-bound validation of both services is mandatory.

**Work-state distinction:** This Technical Design describes an authorized technical **target**, not effective architecture or proof that the defect has been fixed. Security implementation and all required reviews/validation remain outstanding.
