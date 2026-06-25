// src/app.ts

import Fastify from "fastify";
import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url) });

import { RegisterUserUseCase } from "@architecture/identity/application";
import { createDatabase } from "./database.js";
import {
  PasswordHasherArgon2,
  UserRepository,
} from "@architecture/identity/infrastructure";

export const db = createDatabase();

const server = Fastify({
  logger: true,
});

const register = new RegisterUserUseCase(
  new UserRepository(db),
  new PasswordHasherArgon2(),
);

server.post<{
  Body: {
    email: string;
    password: string;
  };
}>("/register", async (request, reply) => {
  const result = await register.execute(request.body);

  if (result.success) {
    return reply.code(201).send({
      userId: result.value.userId,
    });
  }

  switch (result.error.code) {
    case "USER_ALREADY_EXISTS":
      return reply.code(409).send({
        error: "USER_ALREADY_EXISTS",
      });

    case "INVALID_EMAIL":
      return reply.code(400).send({
        error: "INVALID_EMAIL",
      });

    case "PASSWORD_TOO_WEAK":
      return reply.code(400).send({
        error: "PASSWORD_TOO_WEAK",
      });

    default:
      return reply.code(500).send();
  }
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
