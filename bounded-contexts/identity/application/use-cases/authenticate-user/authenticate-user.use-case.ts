import type { PasswordHasherPort } from "../../ports/password-hasher.port.js";
import type { UserPort } from "../../ports/user.port.js";
import type { AuthenticateUserCommand } from "./authenticate-user.command.js";
import { Result } from "@architecture/foundation";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import type { AuthenticateResult } from "./authenticate-user.result.js";

export class AuthenticateUserUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly password: PasswordHasherPort,
  ) {}

  async execute(payload: AuthenticateUserCommand): Promise<AuthenticateResult> {
    const email = EmailValueObject.create(payload.email);
    if (!email.success) {
      return Result.failure({
        code: "INVALID_EMAIL",
      });
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure({
        code: "INVALID_PASSWORD",
      });
    }

    const user = await this.user.findByEmail(email.value);

    if (!user) {
      await this.password.fakeVerify(); // Timing attack prevention

      return Result.failure({
        code: "INVALID_CREDENTIALS",
      });
    }

    const passwordVerified = await this.password.verify(
      password.value,
      user.password,
    );

    if (!passwordVerified) {
      return Result.failure({
        code: "INVALID_CREDENTIALS",
      });
    }

    return Result.ok({ userId: user.identifier.value });
  }
}
