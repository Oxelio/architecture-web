import Fastify from "fastify";
import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url) });

import { Register } from "@architecture/identity/application/uses-cases";
import { Argon2PasswordHasher } from "@architecture/identity/infrastructure/adaptaters";
import { UserRepository } from "@architecture/identity/infrastructure/persistence/repositories";
import { createDatabase } from "./database.js";

export const db = createDatabase();

const server = Fastify({
  logger: true,
});

const register = new Register(
  new UserRepository(db),
  new Argon2PasswordHasher(),
);

server.post<{
  Body: {
    email: string;
    password: string;
  };
}>("/register", async (request, reply) => {
  const result = await register.execute({
    email: request.body.email,
    password: request.body.password,
  });

  if (result.success) {
    return reply.code(201).send();
  }

  return reply.code(400).send();
});

server.get("/", async () => {
  return { hello: "world" };
});

server.listen({ port: 80, host: "0.0.0.0" }, function (err) {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
