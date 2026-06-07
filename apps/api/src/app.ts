import Fastify from "fastify";
import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url) });

import { Register } from "@architecture/identity/application/uses-cases/register";
import { RegisterRequestDTO } from "@architecture/identity/application/dtos/register-request";
import { Email } from "@architecture/identity/domain/value-objects/email";
import { PasswordPlain } from "@architecture/identity/domain/value-objects/password-plain";
import { UserAdapter } from "@architecture/identity/infrastructure/adaptaters/user-repository";
import { PasswordHasherAdapter } from "@architecture/identity/infrastructure/adaptaters/password-hasher";
import { createDatabase } from "./database.js";

export const db = createDatabase();

const server = Fastify({
  logger: true,
});

const register = new Register(new UserAdapter(db), new PasswordHasherAdapter());

server.post<{
  Body: {
    email: string;
    password: string;
  };
}>("/register", async (request, reply) => {
  const dto = new RegisterRequestDTO(
    Email.of(request.body.email),
    PasswordPlain.create(request.body.password),
  );

  await register.execute(dto);

  return reply.code(201).send();
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
