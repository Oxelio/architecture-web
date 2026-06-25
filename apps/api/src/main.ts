// src/main.ts

import { buildServer } from "./server.js";
import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url) });

async function bootstrap() {
  const server = await buildServer();

  await server.listen({ port: 3000, host: "0.0.0.0" });
}

await bootstrap();
