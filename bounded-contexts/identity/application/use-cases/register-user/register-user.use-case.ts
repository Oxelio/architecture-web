// bounded-contexts/identity/application/features/register-user/register-user.use-case.ts

import type { PasswordHasherPort } from "#ports/password-hasher.port";
import type { UserPort } from "#ports/user.port";
import { UserEntity } from "#entities/user.entity";
import { Result } from "@architecture/foundation";
import type { RegisterUserCommand } from "./register-user.command.js";
import type { RegisterResult } from "./register-user.result.js";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

export class RegisterUserUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly password: PasswordHasherPort,
  ) {}

  async execute(payload: RegisterUserCommand): Promise<RegisterResult> {
    const email = EmailValueObject.create(payload.email);
    if (!email.success) {
      return Result.failure(email.error);
    }

    const existingUser = await this.user.findByEmail(email.value);
    if (existingUser) {
      return Result.failure({
        kind: "user.already_exists",
      });
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(password.error);
    }

    const hashedPassword = await this.password.hash(password.value);

    const user = UserEntity.create({
      email: email.value,
      password: hashedPassword,
    });
    await this.user.save(user);

    return Result.ok({
      userId: user.identifier.value,
    });
  }
}
