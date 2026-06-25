// src/composition-root/application.container.ts

import { createDatabase } from "./database.container.js";
import { buildIdentityContainer } from "./identity.container.js";

export function buildApplicationContainer() {
  const db = createDatabase();

  const identity = buildIdentityContainer(db);

  return {
    identity,
  };
}
