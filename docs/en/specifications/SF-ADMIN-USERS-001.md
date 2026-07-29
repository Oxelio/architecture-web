# Search and Pagination for User Administration

> **Identifier:** SF-ADMIN-USERS-001
>
> **Status:** Implemented
>
> **Related documentation:**
> [Packages and public APIs](../architecture/packages.md),
> [Adding a feature](../development/adding-a-feature.md),
> [HTTP interface](../reference/http-api.md)

## Business Context

IAM administration currently allows an administrator to view users, search for
an account by email address or identifier, filter accounts by role or status,
and act on the selected account.

The current implementation nevertheless loads every user from the database and
returns the complete collection to the client. Search, filters, and statistics
are then computed in the React application.

This works for a very small volume, but the response size and cost of each
refresh grow with the total number of accounts. The endpoint is unbounded and
therefore is not a durable basis for an administration feature expected to
grow.

## Observed Current State

At the time this specification was written:

- `ListUsersUseCase` only receives the administrator identifier;
- `UserAdministrationRepository.findAll()` returns all user entities;
- `KyselyUserAdapter.findAll()` sorts users by descending creation date;
- `GET /iam/users` has no query parameters;
- the HTTP client directly returns an `AdminUser[]` array;
- `AdminPage` performs search and filtering in memory;
- total, active, suspended, and administrator indicators are computed from that
  same complete array.

These items describe the current implementation, not the target behavior.

## Functional Objective

Provide a bounded and coherent administration query that allows:

1. searching for a user without loading every account;
2. filtering users on the server;
3. browsing results page by page;
4. keeping accurate global indicators independently from the displayed page;
5. preserving existing administration actions;
6. maintaining coherent contracts across application, API, persistence, and
   web interface.

## Actor and Authorization

Only an authenticated user with the administrator role may view the
administrative list or its indicators.

The new search and pagination parameters do not change the existing
authorization rule. Authorization must be checked before administrative data
is queried or returned.

A non-administrator must not receive a result, total, or indicator from which
the existence or state of other accounts could be inferred.

## Search and Filters

The list must accept the following optional criteria:

- `search`: search by email address or user identifier;
- `role`: `user` or `admin`;
- `status`: `active` or `suspended`;
- `emailVerified`: verified or unverified account.

Search must follow these rules:

- leading and trailing whitespace is ignored;
- a value that is empty after normalization is equivalent to no search;
- email address search is case-insensitive;
- identifier search accepts a partial match to preserve the current interface
  behavior;
- the HTTP contract limits the search term length;
- multiple active filters are combined with `AND`.

The first version does not need advanced query syntax, regular expressions, or
fuzzy search.

## Pagination

The list uses page-number pagination.

Initial values are:

- default page: `1`;
- default page size: `25`;
- maximum page size: `100`.

The following rules apply:

- page and page size are strictly positive integers;
- a size over the maximum is rejected by the contract instead of being silently
  accepted;
- a valid page with no result returns an empty collection;
- no list endpoint may bypass the maximum size;
- total is the number of accounts matching the current search and filters.

Cursor pagination may replace this model if volume or performance measurements
justify it. It is not required by this specification.

## Result Ordering

The first version retains a fixed order:

1. creation date descending;
2. user identifier descending to break ties between identical dates.

Ordering must be deterministic so that a user does not move arbitrarily between
pages while data remains unchanged.

Configurable column sorting is outside the first version scope.

## Expected Result

The list use case must return an explicit business structure, independent from
its HTTP representation, equivalent to:

```text
ListUsersResult
- users
- pagination
  - page
  - pageSize
  - total
  - totalPages
```

`users` contains the administrative representations already exposed:

- identifier;
- email address;
- role;
- status;
- email verification state;
- creation date;
- last update date.

The public contract must not expose the password hash or other internal data
that is unnecessary for administration.

The repository may return a structure closer to persistence, made of the page
of entities and the total matching the criteria. The use case remains
responsible for building the application result and computing derived metadata
such as `totalPages`.

The generic names `data` and `meta` must not be introduced into bounded-context
contracts. They describe a representation convention rather than the language
of the IAM application.

## HTTP Representation

The HTTP presenter transforms the application result into a stable envelope:

```json
{
  "data": [
    {
      "userId": "8da4d811-0196-4c40-a878-d89730725683",
      "email": "user@example.com",
      "role": "user",
      "status": "active",
      "isEmailVerified": true,
      "createdAt": "2026-07-29T08:00:00.000Z",
      "updatedAt": "2026-07-29T08:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "total": 142,
      "totalPages": 6
    }
  }
}
```

The HTTP convention is:

- `data` contains the requested resource or collection;
- `meta` contains representation information accompanying the resource;
- pagination is placed in `meta.pagination`;
- `meta` remains optional for responses without metadata;
- the API must not produce an empty `meta` object;
- administration statistics are a separate resource and are therefore placed
  in `data`, not `meta`.

Pagination facts are computed or carried by the bounded context, but the choice
of `data`, `meta`, and `pagination` keys in the public response belongs to the
HTTP adapter.

## Administration Indicators

Indicators displayed above the list represent all users, not only the current
page.

They must expose at least:

- total number of accounts;
- number of active accounts;
- number of suspended accounts;
- number of administrator accounts.

These indicators are provided through a use case and endpoint separate from the
paginated list. They do not change with the list search criteria.

This separation allows the list and indicators to be cached and refreshed
independently. After a role or status change, the client must invalidate both
datasets.

## User Experience

The administration interface must:

- send active filters to the API;
- include every criterion in the React Query cache key;
- return to the first page when a criterion changes;
- limit calls during typing with a short delay, for example 300 milliseconds;
- display the result total and current pagination position;
- provide previous-page and next-page controls;
- disable unavailable controls;
- distinguish initial loading, refresh, empty list, and error;
- preserve localized labels and feedback;
- close or reconcile the detail panel when the selected user no longer belongs
  to the current page or filters.

Criteria and page should be synchronized with the URL to make the view
reloadable and shareable, but this is not a blocking condition for the first
delivery.

## Repository Contract Direction

This change must not introduce a separate one-method port without a concrete
need.

For the module in its current state:

- `UserAdministrationRepository` must be removed;
- coherent user operations remain grouped in `UserRepository`;
- `findAll()` must be replaced by a bounded operation such as
  `search(criteria)`;
- `SessionListingRepository` must be removed;
- `findActiveForUser()` must move into `SessionRepository`.

This grouping is appropriate while a single Kysely adapter implements every
user operation and a single Redis adapter implements every session operation.

A new port should only be introduced when a responsibility genuinely evolves
separately, for example:

- a different store or read model is used;
- implementations are available with different capabilities;
- a group of operations becomes large or follows another evolution cycle;
- an administrative read contract no longer returns domain entities.

Capabilities must then be composed explicitly, without using a port name as an
authorization mechanism.

## Layer-by-Layer Implementation Plan

### IAM Application

1. Define search criteria, pagination, and the paginated result.
2. Add optional parameters to `ListUsersInput`.
3. Replace the array in `ListUsersOutput` with a named result containing `users`
   and `pagination`.
4. Validate and normalize bounds at the appropriate layer without depending on
   HTTP.
5. Replace `findAll()` with the bounded repository query.
6. Add `GetUserAdministrationOverviewUseCase`.
7. Keep administrator authorization in both use cases.
8. Simplify repository types and their public exports.
9. Adapt `createIam`, its dependencies, and its composition tests.

### Kysely Persistence

1. Build a query from present criteria only.
2. Apply filters before counting and pagination.
3. Execute one count query and one bounded selection query.
4. Apply deterministic `created_at DESC, id DESC` ordering.
5. Map only rows from the current page to entities.
6. Add an aggregate query for global indicators.
7. Inspect query plans with a representative volume.
8. Add further indexes only when these measurements justify them, especially
   for partial search.

The project must not introduce a migration speculatively. If an index becomes
necessary, the migration strategy must follow the pre-production state and
schema policy in force at implementation time.

### Fastify API

1. Define a TypeBox schema for query parameters.
2. Bound `search`, `page`, and `pageSize` in that schema.
3. Pass validated criteria to the use case.
4. Adapt the presenter and success schema to the
   `{ data, meta: { pagination } }` envelope.
5. Add the static route for administration indicators.
6. Document parameters and responses in Swagger.
7. Preserve existing authorization errors and add stable errors only if
   application validation requires them.

Changing an array into a paginated object breaks the HTTP contract. The API and
web application must therefore be delivered together. No legacy dual format is
required before production.

### React Application

1. Define criteria, pagination, and indicator types.
2. Build query parameters with `URLSearchParams`.
3. Include page, size, and filters in the React Query key.
4. Replace full in-memory filtering with server results.
5. Keep presentation-only transformations on the client.
6. Add pagination controls and accessible states.
7. Load indicators through a separate query.
8. Invalidate both list and indicators after activation, suspension, or role
   change.
9. Adapt selection and the detail panel to page changes.
10. Add or adapt French and English translations.

### Sessions

User and administrator session lists remain unpaginated in this specification,
provided that the number of active sessions per user is bounded by a business
rule.

If no bound exists, implementation must define one or open a separate
specification before treating this design as durable. User pagination must not
be generalized mechanically to every collection.

## Test Scenarios

Tests must cover at least:

1. rejection of the list for a non-administrator actor;
2. first page with default values;
3. next page without duplicates in a stable dataset;
4. stable ordering when two accounts have the same creation date;
5. valid page after the final result;
6. rejection of a zero, negative, or non-integer page;
7. rejection of a size over the maximum;
8. case-insensitive email search;
9. partial identifier search;
10. combination of search, role, status, and verification;
11. total computed after applying filters;
12. global indicators independent from page and filters;
13. absence of sensitive data from responses;
14. correct translation of new interface states;
15. return to the first page after a filter change;
16. invalidation of list and indicators after a mutation;
17. client adaptation to the new response shape;
18. collection presence in `data` and pagination in `meta.pagination`;
19. absence of an empty `meta` object on responses without metadata;
20. presence of separate statistics in `data`;
21. adapter and fixture compatibility with simplified repositories.

Tests must be distributed according to existing responsibilities:

- use-case unit tests for rules;
- Kysely adapter tests for queries and mapping;
- HTTP contract, controller, and presenter tests;
- React interface tests for primary interactions;
- IAM application composition test.

## Acceptance Criteria

The feature is complete when:

- no list call returns every user without a bound;
- search and filters execute on the server;
- the default page contains at most 25 users;
- no page can exceed 100 users;
- the application result uses the business names `users` and `pagination`;
- the HTTP response places the collection in `data` and pagination in
  `meta.pagination`;
- the bounded context does not depend on the HTTP `data` and `meta` convention;
- total reflects current criteria;
- ordering is deterministic;
- global indicators remain accurate regardless of the displayed page;
- existing administrator permissions are preserved;
- the client no longer filters a complete collection in memory;
- mutations refresh affected data;
- Swagger describes new parameters and formats;
- application, API, and web contracts are synchronized;
- extended ports without a real technical boundary have been simplified;
- essential scenarios are covered by tests;
- affected HTTP and architecture documentation is updated.

## Out of Scope

This specification does not include:

- fuzzy or advanced full-text search;
- arbitrary sorting by every column;
- complete user export;
- bulk selection and actions;
- cursor pagination;
- an external search engine;
- automatic pagination of every other collection;
- a complete CQRS split;
- creation of a distinct port for every repository method.
