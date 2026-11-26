# Technical Design — Atomic session activity updates

> **Identifier:** TD-SESSION-ACTIVITY-001
>
> **Artifact status:** Prepared for implementation
>
> **Content status:** Proposed Target (Work #210; not effective Current Truth)
>
> **Document type:** Technical Design
>
> **Domain:** IAM / session persistence

## Scope and authority

[Work #210](https://github.com/Oxelio/architecture-web/issues/210):
Defect Correction / Complex / security-sensitive and concurrency-sensitive.
Restore existing revocation and expiry guarantees described in
[SF-SESSION-001](../specifications/SF-SESSION-001.md) and
[Authentication and sessions](../guides/iam-sessions.md).
Preserve the existing SessionRepository contract, session generation checks,
authentication, index membership and record format.
This is a local adapter design, not a new structural architecture rule.
No new Functional Specification, human Functional Approval or ADR is triggered.

The [red integration run](https://github.com/Oxelio/architecture-web/actions/runs/45811925466)
on candidate `841dc395e1c8f07a3716ee74659e1258d1a8632c`
reproduces both deletion and Redis expiry between the activity read and write.

## Design

Keep record parsing and date validation in the existing TypeScript adapter.
Read the current record; return without writing if absent, invalid or if
the requested activity timestamp is not newer. Otherwise perform a single-key
atomic compare-and-swap in Redis: compare the complete raw record with the
snapshot read by the adapter, and only on equality replace it using
`SET XX KEEPTTL`. Distinguish missing key, successful update and conflicting
snapshot. On conflict, reread and re-evaluate the timestamp and validity.
If the session disappears, stop. Never recreate a missing key or touch the index.
Preserve existing technical exception propagation; do not turn Redis
unavailability into a successful update.

The comparison uses the raw snapshot rather than re-serialized JSON; replacement
preserves all other fields. Concurrent activity writes cannot overwrite a newer
timestamp. Revocation/expiration that wins before the atomic operation cannot
be undone; a later revocation still removes the key. This does not change the
authorization point of an already executing ResolveSession request.
Retries occur only on competing record changes; ordinary successful updates
use one read and one atomic operation. Review contention behavior and avoid
adding any generic infrastructure or new public port.

## Alternatives

- SET XX KEEPTTL alone prevents resurrection but permits a stale write to
  overwrite a newer activity timestamp.
- A single read/modify/write Lua script could reduce round trips, but would
  duplicate strict record and date validation in Lua or change parsing behavior.
- Compare-and-swap retains the existing validation in one place, needs only one
  key, and re-evaluates conflicting snapshots. Selected within the existing
  Redis adapter; no external contract, data migration or new dependency.

## Validation

Use the [testing policy](../development/testing.md). Unit tests cover missing,
invalid, stale and equal activity, conflict retries and technical failures.
Real Redis tests cover revocation and expiration interleaving, out-of-order
concurrent activity, unchanged expiry and metadata, and index consistency.
Run full candidate CI with real integration endpoints; inspect actual results
rather than treating skipped tests as evidence. Review code, architecture,
functional compliance and security separately. No production rollout or
cleanup of existing orphan keys is implied by this fix.
