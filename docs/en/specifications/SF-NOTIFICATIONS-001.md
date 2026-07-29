# Notification center and multichannel delivery

> **Identifier:** SF-NOTIFICATIONS-001
>
> **Status:** Accepted
>
> **Functional dependencies:**
> [SF-MFA-001](SF-MFA-001.md),
> [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Business context

Account and security actions must be able to inform a user or administrator
without embedding presentation and delivery logic into IAM. A single situation
may require an in-application notification, email, Slack message, or SMS.

The product must also support adding a channel or a new reaction to a business
fact without changing the use case that produced that fact.

## Functional objective

Provide a durable notification center and multichannel delivery capability
that:

- informs users about changes affecting their accounts;
- alerts administrators or the security team under an explicit policy;
- lets users view and acknowledge notifications in the web application;
- delivers the same information through one or more channels;
- tracks delivery attempts without duplicating visible messages;
- preserves clear boundaries between IAM, Notifications, and Audit.

A temporary channel failure must not undo an already completed business
operation.

## Actors

- **User:** views and acknowledges notifications and configures permitted
  preferences.
- **Administrator:** receives and views alerts allowed by their permissions.
- **System:** turns business or security facts into notifications.
- **Operator:** configures providers and monitors delivery failures without
  accessing business secrets.

## Functional boundaries

### IAM

IAM remains the owner of accounts, identities, roles, statuses,
authentication, and sessions. It records facts such as:

- user registered;
- email address changed or verified;
- password changed;
- role changed;
- user suspended or activated;
- session started or revoked;
- MFA enabled or disabled.

IAM chooses neither the channel, message template, nor final recipient list for
a notification.

### Notifications

Notifications is a separate bounded context. It owns:

- notifications and their lifecycle;
- recipients;
- delivery policies;
- permitted preferences;
- channel-specific representations;
- delivery attempts and states.

### Audit

Audit is a separate bounded context governed by
[SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md). It owns the append-only
trail, queries, retention, and exports.

Audit receives successful business facts as well as attempts, rejections, and
security anomalies that do not necessarily correspond to an aggregate
transition.

Audit does not deliver messages directly. When a security policy detects a
situation that must be reported, it produces an alert fact that Notifications
turns into messages for the relevant actors.

## Notification sources

A notification is created in response to a stable fact expressed in the past
tense. Examples include:

- `UserPasswordChanged`;
- `UserEmailChanged`;
- `UserSuspended`;
- `UserRoleChanged`;
- `SessionStarted`;
- `MfaDisabled`;
- `SuspiciousActivityDetected`.

Domain facts describe what happened and do not contain technical instructions
such as `SendEmail` or `PostToSlack`.

Operations without a successful business-state change may also produce
application or security facts, such as a sequence of rejected sign-ins. A
dedicated policy decides whether they trigger a notification.

## Functional model

A notification contains at least:

```text
Notification
- identifier
- stable, versioned type
- recipient
- creation time
- severity: information, warning, or critical
- displayable title and message
- optional action to an authorized destination
- state: unread, read, or archived
- source fact and correlation identifier
- requested deliveries by channel
```

Each delivery contains:

```text
Delivery
- channel
- state: pending, sent, temporarily failed, or permanently failed
- attempt count
- last-attempt time
- optional minimized technical reference
```

Retrying delivery does not create another visible notification for the same
recipient and source fact.

## Web notification center

An authenticated user can:

- view notifications in deterministic newest-first order;
- see the unread notification count;
- mark one notification as read;
- mark all notifications as read;
- open the associated action while it remains valid.

Queries are bounded and paginated. A user can neither view nor change another
user's notifications.

A notification may be displayed in real time while the client is connected.
Lack of a real-time connection must not prevent later viewing.

## Channels

The initial target architecture supports these channel categories:

- **Web:** persisted notification displayed in the application;
- **Email:** message sent to a verified address;
- **Slack:** message sent to a configured administrative workspace or channel;
- **SMS:** short message sent to a verified and authorized phone number.

Channel availability depends on deployment configuration. Adding or removing a
technical provider does not change the business meaning of a notification.

A policy may request several channels for one recipient. Failure on one channel
does not prevent attempts on the other channels.

## Recipients and policies

The notification policy selects recipients from the fact type, sensitivity,
and authorized context:

- the affected user;
- one or more authorized administrators;
- an operational destination such as a security Slack channel.

The fact producer must not embed an email address, phone number, or Slack
destination into the event.

Administrative alerts honor permissions and disclose only necessary data. Role
membership at delivery time is checked under the applicable policy.

## Preferences

A user may disable optional channels or choose among available channels.

Critical security notifications may be mandatory. Policy explicitly defines:

- notifications that cannot be disabled;
- minimum required channels;
- optional fallback channels;
- administrative recipients.

A preference can never disable recording an event in Audit.

## Initial catalog

The first version must support policies for:

- registration and email-address verification;
- email-address or password changes;
- new sessions or session revocation;
- MFA enablement, disablement, and recovery-mechanism use;
- account recovery;
- role changes, suspension, and activation;
- account-deletion request and execution;
- suspicious activity detected under a separate policy.

This catalog is extensible. Adding a channel or reaction must not require
changing the original business fact.

## Reliability and consistency

A fact associated with a persisted change is eligible for distribution only
after that change succeeds.

An accepted notification must be recoverable after a temporary outage. The
system provides:

- a stable identifier for the fact and notification;
- idempotent consumption;
- bounded and observable attempts;
- no visible duplicate despite potentially repeated delivery;
- an explicit final state when a channel can no longer be delivered.

Notifications are eventually consistent with the business operation.
Immediate security invariants, such as rejecting an invalid session, do not
depend solely on a notification or asynchronous process.

## Personal data and secrets

Events, notifications, and deliveries minimize personal data. They never
contain:

- a password or confirmation;
- a plain-text session, recovery, or verification token;
- an MFA secret or recovery code;
- an authorization header;
- an unfiltered request body.

A web notification displays no data more sensitive than its recipient is
allowed to access when opening it.

Single-use links use a protected delivery mechanism. Their sensitive contents
are not exposed in a generic business event or the audit trail.

## Relationship with Audit

Successful business facts may feed Notifications and Audit at the same time.
Each bounded context interprets them according to its responsibility:

- Notifications decides whether to inform someone and tracks delivery;
- Audit keeps structured evidence of the action or attempt.

Ordinary provider delivery failures remain in Notifications delivery history.
A failure with security significance, a policy change, or a sensitive
administrative query may also create an Audit entry.

## Target structural principles

This section states constraints needed for the functional behavior; it does not
describe the current implementation.

- Business events belong to the bounded context producing the fact.
- Other bounded contexts consume a public, versioned integration contract,
  never an internal entity from the producer.
- Generic event primitives may belong to Foundation.
- Publishing, retries, idempotency, and the outbox belong to shared messaging
  infrastructure.
- This technical infrastructure is not a DDD Shared Kernel.
- A possible Shared Kernel would contain only a deliberately shared business
  model with joint governance.
- Transactional storage of an outgoing fact remains coordinated with the
  producer bounded context's storage.

The repository currently provides neither a Notifications bounded context, an
event bus, nor a durable outbox. Their introduction is therefore a future
change and requires a detailed architecture decision before implementation.

## Test scenarios

Tests cover at least:

1. creation of a notification from an eligible fact;
2. no notification when no policy matches;
3. correct selection of user and administrator recipients;
4. preferences and mandatory-notification handling;
5. paginated queries restricted to the recipient;
6. unread count and individual or bulk acknowledgement;
7. independent delivery through configured Web, email, Slack, and SMS channels;
8. recovery after a temporary failure;
9. permanent failure after the attempt policy is exhausted;
10. no visible duplicate after repeated consumption;
11. continued delivery through other channels when one provider fails;
12. absence of every secret from events and messages;
13. parallel production of the information required by Audit;
14. later viewing after no real-time connection was available;
15. inability of an IAM producer to select a provider or technical destination
    directly.

## Acceptance criteria

The feature is complete when users can view and acknowledge their
notifications, policies select the correct recipients and channels, delivery
is retried without visible duplication, administrative alerts honor
permissions, secrets are excluded, and Audit receives the necessary facts
independently of delivery.

## Out of scope

This specification does not include:

- a complete fraud-detection engine or SIEM;
- using SMS or email as an authentication factor;
- marketing content and commercial campaigns;
- two-way conversation through Slack or SMS;
- a delivery guarantee from an external carrier;
- Event Sourcing;
- a business Shared Kernel between IAM, Notifications, and Audit.
