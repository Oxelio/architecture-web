# Work #49 — Proposed containment and cutover plan

**Status:** Proposed operational plan; not an execution instruction or approval.  
**Depends on:** [Decision register](work-49-decision-register.md), especially D3–D6; [Technical Design](../../architecture/iam-session-credential-separation.md).  
**No live inventory or deployment action has been performed.**

## 1. Exposure inventory — evidence first

For every environment, determine without dumping credentials:

- API instances and deployment versions, worker instances, rollback artifacts and external clients consuming `sid`.
- Active legacy sessions and TTLs, Redis namespace ownership, AOF/snapshot/backup policy, data restoration routes.
- Pending/failed/delivered v1 `iam.session-started` events, including the secret-bearing `aggregateId` and payload.
- Audit rows/metadata and request-path fields containing bearer UUIDs; relevant retention periods and legal holds.
- Cached session listings, export ZIPs in pending/ready states, downloaded ZIPs that cannot be recalled, backup copies.
- Logging/telemetry pipelines, retention policies, support/administrative access, and exposure evidence.

Record versions, counts and ownership; never paste raw cookies, session IDs that remain bearer credentials, or archive bytes into an Issue, CI log or validation report. If real users could have accessed these channels, activate the security/incident process independently of the ordinary implementation workflow.

## 2. Candidate cutover, only after appropriate approvals

1. Deploy compatible safe readers/consumers and secret-free logging policies. Prevent replay/visibility of unsafe v1 event payloads and block unsafe archive downloads **without physical deletion** pending retention decisions.
2. Rehearse recovery/rollback in a representative isolated environment, including Redis AOF restore, in-flight API request behavior, already-issued cookies and dual-write outbox failure.
3. Quiesce old API writers, authentication resolvers, security routes, workers and exports. Verify no old binary can restart into service and authenticate UUID-only cookies.
4. Invalidate all legacy credentials under an approved reauthentication policy. Delete only owned legacy session keys and indices; do not `FLUSHALL`. Ensure restore/restart cannot resurrect valid legacy credentials.
5. Deploy the new issuer/resolver, including both password and MFA login, with version-bound protected verifier and strict v2 parsing. Verify known legacy UUIDs fail, while newly issued cookies work.
6. Apply the approved disposition for old outbox, Audit metadata and ZIPs; resume workers only with verified safe handling. Never relabel a formerly bearer `sessionId` as if it were a safe public reference.
7. Verify revocation, concurrency-safe activity, absolute TTL, session limits, sanitized logs/exports/audit and fallback failure. Record candidate SHA, operator, commands, versions and results.

## 3. Fail-safe rollback criteria

Do not re-enable the UUID-only resolver, accept old cookies, restore a legacy Redis snapshot as live auth state, replay contaminated events unchanged or expose unsafe ZIPs. When a rollback is necessary, either roll forward with a corrected v2 candidate or use a separately reviewed safe fallback that continues to **reject legacy bearer credentials**. Treat any desired zero-logout migration as a new security/functional design decision, not a local operational workaround.

## 4. Required readiness evidence

- Accepted D1/ADR-0008; aligned and reviewed Technical Design for the remaining details.
- D3 deployment and exposure inventory; D4 retention/legal decision; D5 unsafe-archive disposition; D6 sign-out contract decision.
- Cross-boundary test plan with real Redis, outbox/Audit and ZIP integration cases and an identified human validation owner.
- Accepted migration and rollback strategy, service budgets and permissible maintenance window when needed.

**Scope guard:** pending-deletion eligibility, stale PostgreSQL aggregate writes, dynamic policy and full `SecurityService` extraction remain separate Work unless independently authorized.