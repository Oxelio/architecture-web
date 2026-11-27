import { once } from "node:events";

import type { ProtectedResource } from "@architecture/iam/domain";
import {
  type IamDatabase,
  KyselyDelegatedAuthorizationAdapter,
} from "@architecture/iam-persistence-kysely";
import { RedisSessionAdapter } from "@architecture/iam-session-redis";
import {
  KyselyOutboxWriterAdapter,
  type MessagingDatabase,
} from "@architecture/messaging-persistence-kysely";
import Fastify from "fastify";
import { Redis } from "ioredis";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { authPlugin } from "#app/auth";
import type { OAuthOptions } from "#config/oauth.config";

import { buildOAuthRoutes } from "./oauth.routes.js";
import { createOAuthProvider } from "./oauth-provider.js";

if (!process.send) {
  throw new Error("OAuth process fixture requires IPC");
}
const [fixture] = (await once(process, "message")) as [
  {
    database: string;
    redis: string;
    options: OAuthOptions;
    resources: ProtectedResource[];
  },
];
if (
  !new URL(fixture.database).pathname.startsWith("/iam_refactor_test_oauth_")
) {
  throw new Error("OAuth process fixture requires a disposable test database");
}
const db = new Kysely<IamDatabase & MessagingDatabase>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: fixture.database }),
  }),
});
const redis = new Redis(fixture.redis);
const store = new KyselyDelegatedAuthorizationAdapter(
  db.$pickTables<keyof IamDatabase>(),
  (transaction) =>
    new KyselyOutboxWriterAdapter(
      transaction
        .$extendTables<{
          messaging_outbox: MessagingDatabase["messaging_outbox"];
        }>()
        .$pickTables<keyof MessagingDatabase>(),
    ),
);
const app = Fastify({ logger: false });
await app.register(authPlugin, {
  sessionCookieName: "sid",
  resolveSession: {
    execute: async () => ({
      success: false,
      error: { code: "session.unauthorized" },
    }),
  },
});
await app.register(
  buildOAuthRoutes(
    createOAuthProvider(
      fixture.options,
      store,
      new RedisSessionAdapter(redis),
      fixture.resources,
    ),
  ),
);
process.on("disconnect", () => {
  void app.close().finally(async () => {
    redis.disconnect();
    await db.destroy();
  });
});
process.send(await app.listen({ port: 0, host: "127.0.0.1" }));
