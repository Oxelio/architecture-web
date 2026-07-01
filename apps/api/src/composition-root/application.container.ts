// src/composition-root/application.container.ts

import { Redis } from "ioredis";
import { createDatabase } from "./database.container.js";
import { buildIdentityContainer } from "./identity.container.js";
import { buildProfileContainer } from "./profile.container.js";

export function buildApplicationContainer() {
  const db = createDatabase();
  const redis = new Redis({
    host: process.env["REDIS_HOST"],
    port: Number(process.env["REDIS_PORT"]),
  });

  const identity = buildIdentityContainer(db, redis);
  const profile = buildProfileContainer(db);

  return {
    identity,
    profile,
  };
}
