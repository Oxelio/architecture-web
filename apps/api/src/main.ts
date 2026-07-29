// @file apps/api/src/main.ts

// src/main.ts

import { buildServer } from "./server.js";

async function bootstrap() {
  const server = await buildServer();

  await server.listen({ port: 3000, host: "0.0.0.0" });
}

await bootstrap();
