# Setup and runtime

## Prerequisites

- Node.js `26.8.1`, selected by `.nvmrc` (engine-compatible Node 24 starts at 24.15.0);
- pnpm `12.15.0`, as declared by root `packageManager`;
- Docker Compose for PostgreSQL, Redis, and Mailpit, or equivalent services.

CI reads `.nvmrc`; use root `packageManager` for locked dependency installation.

## Install

From the repository root:

```bash
pnpm install
```

## Configure the API

Copy `apps/api/.env.example` to `apps/api/.env` and adjust the values. Zod
validates configuration at startup in `apps/api/src/config/app.config.ts`.

Required variables cover PostgreSQL (`DATABASE_*`), Redis (`REDIS_*`), SMTP
(`SMTP_*`, including the verification, recovery, and deletion-cancellation
URLs), and `SECURITY_ENCRYPTION_KEY`. The latter must be a random value of at
least 32 characters and encrypts TOTP secrets at rest. Rotating it requires a
controlled migration of existing MFA secrets. `COOKIE_SECURE` and
`TRUST_PROXY` adjust cookie and proxy security.

Optional `NOTIFICATIONS_SLACK_WEBHOOK_URL` and
`NOTIFICATIONS_SMS_WEBHOOK_URL` values enable the corresponding notification
adapters.

`WEB_ORIGIN` appears in the example and Compose file, but the current Fastify
configuration uses `origin: true` and does not read it.

## Start services

For the complete environment:

```bash
docker compose up --build
```

Defaults are web on `http://localhost:5173`, API on
`http://localhost:3000`, Swagger UI on `http://localhost:3000/docs`, and
Mailpit on `http://localhost:8025`.

For local app processes backed by Docker services:

```bash
docker compose up postgres redis mailpit
pnpm migrate:up
pnpm dev:api
pnpm dev:web
```

Run the two `dev` commands in separate terminals. The web client defaults to
`http://localhost:3000/v1`; `VITE_API_BASE_URL` overrides it.

Do not run the `dev` commands while the Compose `api` and `web` services are
active because they already bind ports `3000` and `5173`. For local
development, run `docker compose stop api web` first while keeping PostgreSQL,
Redis, and Mailpit running.

## Migrations and administration

```bash
pnpm --filter api migrate:up
pnpm --filter api migrate:down
pnpm --filter api migrate:reset
pnpm --filter api promote:admin <email>
pnpm --filter api promote:admin:id <user-id>
```

Migration `003_create_iam_security` adds account recovery, MFA, auditing,
versioned configuration, exports, and deferred deletion. The deployment
scheduler should invoke the administrator-only
`POST /v1/iam/admin/security/maintenance` endpoint periodically to process
retention and due deletions.

Migration `004_add_iam_aggregate_consistency` adds the user session version and
the foreign-key constraint connecting a verification to its user.

`migrate:reset` is destructive to local data. Read the script before using it
against a shared environment. The promotion script is the source of truth for
its exact arguments.

## Entry points

- API: `apps/api/src/main.ts`, then `server.ts`;
- composition: `apps/api/src/composition-root/application.module.ts`;
- IAM routes: `apps/api/src/features/iam/routes/index.ts`;
- security HTTP: `apps/api/src/features/iam/security/security.routes.ts`;
- security use cases: `packages/contexts/iam/src/application/create-iam-security.ts`;
- web: `apps/web/src/main.tsx`, then `App.tsx`;
- web HTTP client: `apps/web/src/services/api.ts`.
