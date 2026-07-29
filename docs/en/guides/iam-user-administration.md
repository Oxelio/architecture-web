# User administration

This guide describes the administration read model implemented for
[SF-ADMIN-USERS-001](../specifications/SF-ADMIN-USERS-001.md). It complements
the [HTTP reference](../reference/http-api.md), while TypeBox schemas and
Swagger remain the source of truth for the public routes.

## Business boundary

The `access-administration` capability distinguishes two resources:

- a searched, filtered, and paginated list;
- global indicators independent from list filters and page.

`ListUsersUseCase` and `GetUserAdministrationOverviewUseCase` authorize the
actor with `AdministratorAuthorizer` before running administrative reads. The
actor must exist, be active, and have the `admin` role. The Fastify hook also
protects the route group, but does not replace this application rule.

The application list result uses IAM language:

```text
ListUsersResult
├── users
└── pagination
    ├── page
    ├── pageSize
    ├── total
    └── totalPages
```

Defaults are page `1` and page size `25`; the maximum size is `100`. The use
case rejects non-integer or sub-one pages and out-of-range sizes. A search term
that becomes empty after trimming is omitted.

## Port and persistence

`UserRepository` groups user operations while `KyselyUserAdapter` implements
them through the same storage and evolution cycle. It notably exposes:

- `search(criteria)` for bounded reads;
- `getAdministrationOverview()` for global aggregation.

`KyselyUserAdapter.search` combines present criteria with `AND`. The search term
partially matches email with `ILIKE` and identifier with `LIKE`. Count and
selection use the same filters.

The page is ordered by `created_at DESC`, then `id DESC`, before `limit` and
`offset`. The adapter selects and maps only page rows into entities. Counts for
total, active, suspended, and administrator accounts come from a separate
aggregation query.

No migration or additional search index was introduced. Current tests verify
query construction with Kysely doubles; an `EXPLAIN` analysis on representative
data remains necessary before deciding on an index for partial search.

## HTTP transport

`GET /v1/iam/users` accepts `search`, `role`, `status`, `emailVerified`, `page`,
and `pageSize`. The presenter maps the business result to the public
convention:

```json
{
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

`GET /v1/iam/users/overview` returns indicators under `data` without `meta`,
because they are a separate resource rather than page metadata.

Administrative representations contain only identifier, email, role, status,
email-verification state, and dates. Password hashes and other internal details
do not cross this boundary.

## React client

`AdminPage` keeps criteria and page in local state. Every criterion belongs to
the list's React Query key. Search input is debounced by 300 milliseconds; a
search or filter change returns to page one and closes the selected detail.

List and indicators use separate React Query requests. Activation, suspension,
or role changes invalidate both keys. Sessions for the selected user retain
their own key.

The interface distinguishes initial loading, refresh, error, and empty results.
Previous and next controls are disabled when navigation is impossible.

## Observed limits

- Criteria are not synchronized with the URL; reloading restores initial
  values.
- Page-number pagination uses `offset`. A concurrent creation or update between
  requests can move a row despite deterministic ordering for stable data.
- The repository has no PostgreSQL integration test or query-plan measurement
  for this read.

These limits describe current evidence; they are neither guarantees nor settled
replacement decisions.
