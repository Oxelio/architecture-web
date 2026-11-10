# ADR-0010 — IAM owns authoritative evidence of final account erasure for delivery eligibility

**Status:** Accepted
**Content status:** Canonical
**Document type:** Architecture Decision Record
**Domain:** IAM / Notifications

## Context and constraints

[Work #120](https://github.com/Oxelio/architecture-web/issues/120) introduces
fresh IAM eligibility for each new affected-user delivery attempt. A missing
account alone does not establish final erasure. The approved
[Notifications specification](../../specifications/SF-NOTIFICATIONS-001.md#delivery-eligibility-after-final-account-erasure)
allows a previously authorized attempt to transmit after commit and preserves
IAM erasure independence from Notifications and the provider.
[ADR-0005](0005-domain-events-messaging.md) assigns the outbox to cross-context
delivery. IAM already commits the account deletion and the corresponding
pseudonymous fact together.

## Options considered

| Option                                 | Advantages                                                                                                                                                                  | Costs and failure semantics                                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IAM-owned pseudonymous erasure witness | IAM owns the proof and can read it with the account from a single primary PostgreSQL snapshot. An indexed point lookup is independent of transport history and publication. | Adds one potentially linkable record and one indexed write to the erasure transaction. Witness persistence failure rolls back erasure. Recovery must preserve account and witness consistency.                                     |
| Read the Messaging outbox              | Reuses a pseudonymous fact committed with erasure. A lookup by topic, version, and aggregate reference can use a composite index.                                           | Couples the classification of an absent account to Messaging retention, replay, and restore. Expiry could remove the proof while the account remains erased. A durable outbox evidence lifecycle would require separate authority. |

## Decision

Use the IAM-owned witness. IAM derives a domain-separated, versioned
SHA-256 key from the canonical account UUID and stores the 32-byte key as
the primary key. The witness contains no raw identifier, address, content, or
transport metadata. It has no foreign key to the erased account. IAM writes
it in the existing transaction that deletes the account and appends the
unchanged outbox fact.

The witness-key derivation must remain stable for the lifetime of its
records. Any version change requires backward-compatible lookup or an
explicit evidence migration strategy before activation.

IAM reads account existence and witness existence with one plain statement on
primary PostgreSQL. At the default Read Committed isolation level, one
statement shares a snapshot across both checks. Consecutive statements can
observe different commits. The read takes no account row lock, and IAM does
not wait for Notifications or provider progress. The statement snapshot
establishes the time of eligibility evaluation. A later erasure commit does
not retroactively change that evaluation.

Return confirmed erasure only for an absent account with a witness. A present
account without a witness remains eligible on its affected-user basis under
the existing rules. Both present, both absent, or an unavailable read yields
unresolved eligibility. Outbox publication, failure, or expiry does not
participate in that decision.

## Consequences and limits

- Create witnesses prospectively. A previously erased account without a
  witness remains unresolved. Do not infer proof from historical transport
  rows. Restore account and witness data consistently. An older snapshot
  taken before erasure can still restore an account, so this decision provides
  no guarantee of erasure across such a restore.
- Treat the key as potentially linkable. IAM owns its storage, and the
  approved disposable test environment owns its teardown. Production
  activation requires an approved purpose, retention and disposal rule, and
  recovery evidence for the witness. The decision assigns neither an outbox
  retention period nor a replay-marker expiry.
- Option B remains an attempt-authorization boundary. The witness supplies
  evidence at evaluation time and does not order provider transmission with
  erasure commit.

## Target and synchronization

The [Human project acceptance](https://github.com/Oxelio/architecture-web/issues/120#issuecomment-6745724354)
covers the Work #120 development/demo target and the witness-key
compatibility rule. The [Technical Design](../delivery-eligibility-after-account-erasure.md)
owns the implementation target. Synchronize current architecture and package
documentation when the design takes effect.
