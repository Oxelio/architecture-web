# Enrich Active Sessions with Identification Information

> **Identifier:** SF-SESSION-001
>
> **Status:** Implemented
>
> **Technical documentation:** [Authentication and sessions](../guides/iam-sessions.md)

## Business Context

The application currently allows active sessions associated with a user to be deleted.

Two types of actors can perform this action:

- a user can view and delete only their own sessions;
- an administrator can view and delete sessions belonging to any user they are authorized to manage.

At present, a session is mainly identified by its technical identifier. This identifier does not allow a person to understand which device, browser, application, or login context the session corresponds to.

When a user has several active sessions, they cannot easily determine which one should be kept or revoked. Likewise, an administrator has too little information to analyse a session or identify a potentially unusual connection.

## Functional Objective

Enrich sessions with understandable information that allows:

1. a user to identify the different active sessions associated with their account;
2. a user to determine which session they want to revoke;
3. an administrator to understand the probable origin of a session;
4. an administrator to identify an unusual or potentially suspicious session more easily.

The technical session identifier must remain available for internal operations, but it must no longer be the only information available to identify a session.

## Expected Session Information

Each session must be able to expose the following information when it is available.

### Device and Operating System

- device type, such as desktop computer, mobile phone, tablet, or unknown device;
- operating system, such as Windows, Linux, macOS, Android, or iOS;
- operating-system version when it can be determined reliably.

### Browser or Application

- browser name;
- browser version when available;
- client application name when the connection does not originate from a browser;
- support for an unknown client when the information cannot be determined.

### IP Address and Location

- the IP address used when the session was created or associated with the relevant connection;
- an approximate location associated with the IP address when this feature is available;
- the country should be available at minimum when location data can be resolved;
- the city or region may also be included when the available data is sufficiently reliable.

The location must always be presented as approximate. It must not be treated as the user's exact physical position.

### Dates and Activity

- session creation date;
- date of the last known activity;
- expected expiration date when sessions have an expiration time;
- status indicating whether the session is still active;
- information allowing the user to identify the session currently being used.

## Expected User Behaviour

When a user views their active sessions, each session must contain enough information to distinguish it from the others.

A session could, for example, be represented functionally as follows:

```text
Chrome on Windows
Paris, France — IP address 192.0.2.10
Created on 12 July 2026
Last activity 5 minutes ago
Current session
```

The user must be able to:

- view only sessions that belong to them;
- identify the session currently being used;
- revoke another session;
- avoid accidentally revoking the current session without an explicit warning;
- distinguish sessions created from different devices, browsers, or applications.

If the application allows the current session to be revoked, this behaviour must be explicit and must log the user out.

## Expected Administrator Behaviour

An administrator must be able to view the same information for sessions belonging to users they are authorized to manage.

The administrator must be able to:

- identify the user who owns the session;
- view device, operating-system, browser, IP-address, location, and activity information;
- revoke an active session;
- distinguish several sessions belonging to the same user;
- identify an old, inactive, or potentially unusual session more easily.

This feature must not change the existing authorization rules:

- a user can view or revoke only their own sessions;
- an administrator can view or revoke sessions according to the administrative permissions already defined in the project.

## Session Creation and Updates

When a new session is created, the system must collect the information available from the request context or client.

This information may come from:

- the request IP address;
- the `User-Agent` header;
- metadata sent by a client application;
- the creation timestamp;
- an existing activity-tracking mechanism.

The agent must analyse the current architecture to determine which information should be:

- persisted directly with the session;
- calculated when the session is read;
- enriched through an external service or infrastructure adapter;
- represented as optional when it is unavailable.

The domain or application core must not depend directly on a `User-Agent` parsing library, an IP geolocation provider, or an HTTP framework.

Data originating from the HTTP environment must be converted into business data or session metadata before entering the application core.

## Last Activity

The session must expose a last-activity date.

The agent must first check whether an equivalent concept already exists in the project.

If it does not exist, the agent must propose and implement a coherent mechanism that updates this information without unnecessarily writing to the database for every request.

A throttling strategy may be used, for example by updating the last-activity timestamp only after a defined interval.

The technical approach is left to the agent, but the functional behaviour must remain as follows:

- recent activity must be distinguishable from an inactive session;
- the displayed value does not need to be accurate to the second;
- the mechanism must not create disproportionate storage load.

## IP-Based Location

The location associated with a session is optional.

The absence of a geolocation service or a failure to resolve an IP address must never prevent:

- session creation;
- user authentication;
- session listing;
- session revocation.

The following cases must be handled:

- local IP address;
- private IP address;
- loopback address;
- unknown IP address;
- proxy or reverse proxy;
- several addresses present in forwarded headers;
- geolocation-provider failure;
- unavailable location.

The real client IP address must only be extracted from headers such as `X-Forwarded-For` when the application is configured to trust the relevant proxy.

## Data Protection

Session information may contain personal data or information that is sensitive from a privacy perspective.

The implementation must follow these principles:

- collect only the information necessary for session identification and security;
- do not collect precise geographic coordinates;
- do not introduce invasive device fingerprinting;
- do not expose session information to unauthorized users;
- do not write complete session identifiers or authentication tokens to logs;
- never expose the secret or token that allows a session to be used;
- provide clear representations for optional, unavailable, or unknown values.

The agent must check whether a session retention or deletion policy already exists and comply with it.

## Expected Functional Model

The model exposed by the application must be able to represent at least:

```text
Session
- identifier
- creation date
- last activity date
- optional expiration date
- active or expired status
- current-session indicator
- optional IP address
- optional approximate location
- optional device type
- optional operating system
- optional browser or application
```

This list describes the functional requirement. The agent must determine the exact technical structure according to the conventions already used in the project.

It may be relevant to group some information into dedicated objects, for example:

- client information;
- network information;
- approximate location;
- activity information.

However, the agent must not introduce unnecessary abstractions if the project already contains suitable models.

## Initial Storage Model

Because the project has not been deployed to production, no previous session format needs to be preserved. Every Redis record must contain creation, last-activity, and expiration timestamps.

Information that genuinely depends on the client or external services remains optional: device, browser, IP address, and approximate location. Its absence must not block authentication.

## APIs and Contracts

The contracts used to create, read, and list sessions must be adapted to expose the new useful information.

The agent must identify:

- commands or use cases responsible for session creation;
- use cases allowing users to view their sessions;
- administrative use cases;
- related persistence ports;
- HTTP adapters or other input interfaces;
- response representations returned to clients.

Public contracts must expose only the information required to display and manage a session.

Internal domain objects and API response objects may remain separate when this separation is consistent with the current architecture.

Any incompatible change to a public contract must be explicitly documented in the agent's implementation report.

## Authorization Rules

The following rules must be guaranteed by tests:

1. a user can view their own sessions;
2. a user cannot view another user's sessions;
3. a user can revoke one of their own sessions;
4. a user cannot revoke another user's session;
5. an authorized administrator can view sessions belonging to the relevant users;
6. an authorized administrator can revoke a session;
7. the additional metadata must not bypass the existing authorization rules.

## Edge Cases

The implementation must handle at least the following situations:

- missing `User-Agent`;
- invalid or unrecognized `User-Agent`;
- unknown browser;
- custom client application;
- missing IP address;
- local or private IP address;
- location that cannot be determined;
- session created before metadata support was added;
- missing last-activity date;
- expired session still present in storage;
- currently used session;
- several sessions with similar information;
- attempt to access another user's session.

## Requested Work

1. Analyse the existing session model and the use cases responsible for session creation, listing, and revocation.
2. Identify the layers and contracts affected by session enrichment.
3. Evolve the model so that it can represent the required information.
4. Collect the available information when a session is created.
5. Add or adapt last-activity tracking.
6. Adapt session persistence.
7. Define one strict Redis format without a historical compatibility branch.
8. Adapt user and administrator use cases.
9. Adapt the affected input and output contracts.
10. Add any required enrichment mechanisms behind abstractions consistent with the architecture.
11. Add relevant unit, integration, and authorization tests.
12. Update the session-module documentation.
13. Provide a summary of the implementation decisions and any required migrations.

## Acceptance Criteria

The task is complete when:

- a new session contains or exposes the available information about the client used;
- sessions can be distinguished using information other than their identifier;
- device and operating-system information is exposed when it can be determined;
- browser or client-application information is exposed when it can be determined;
- the IP address is associated with the session when possible;
- an approximate location can be exposed but remains optional;
- the creation date is available;
- the last-activity date is available;
- the current session can be identified in the user's session list;
- no historical session format is supported;
- a client-analysis or geolocation failure does not block authentication;
- user and administrator permissions remain enforced;
- no secret session information is exposed;
- the new behaviour is covered by tests;
- technical decisions and contract impacts are documented.

## Out of Scope

Unless required by the existing architecture, this task does not include:

- developing a complete graphical user interface;
- creating an advanced automatic fraud-detection system;
- automatically blocking a connection based on location;
- calculating a precise geographic position;
- implementing complete device fingerprinting;
- sending email alerts for new connections;
- modifying the general authentication rules.

The objective is to enrich sessions so that they can be understood, identified, and revoked reliably.
