// bounded-contexts/identity/application/features/register-user/register-user.use-case.ts

import type { PasswordHasherPort } from "../../ports/password-hasher.port.js";
import type { UserPort } from "../../ports/user.port.js";
import { UserEntity } from "#entities/user.entity";
import { Result } from "@architecture/foundation";
import type { RegisterUserCommand } from "./register-user.command.js";
import type { RegisterResult } from "./register-user.result.js";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";

export class RegisterUserUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly password: PasswordHasherPort,
  ) {}

  async execute(payload: RegisterUserCommand): Promise<RegisterResult> {
    const email = EmailValueObject.of(payload.email);

    const existingUser = await this.user.findByEmail(email);
    if (existingUser) {
      return Result.failure({
        code: "USER_ALREADY_EXISTS",
      });
    }

    const password = PasswordHashValueObject.of(payload.password);
    const hashedPassword = await this.password.hash(password);

    const user = UserEntity.create({
      email: email,
      password: hashedPassword,
    });
    await this.user.save(user);

    return Result.ok({
      userId: user.identifier.value,
    });
  }
}
