import type { PasswordHasherContract } from "#contracts/password-hasher";
import type { UserContract } from "#contracts/user";
import type { AuthenticationUserCommand } from "../commands/authentication-user.js";
import { Result } from "@architecture/foundation";
import type { AuthenticateResult } from "../errors/authenticate.js";
import { Email } from "#value-objects/email";
import { PasswordPlain } from "#value-objects/password-plain";

export class Authenticate {
  constructor(
    private readonly user: UserContract,
    private readonly password: PasswordHasherContract,
  ) {}

  async execute(
    payload: AuthenticationUserCommand,
  ): Promise<AuthenticateResult> {
    const email = Email.of(payload.email);
    const password = PasswordPlain.create(payload.password);
    const user = await this.user.findByEmail(email);

    if (!user) {
      await this.password.fakeVerify(); // Timing attack prevention

      return Result.failure({
        code: "INVALID_CREDENTIALS",
      });
    }

    const passwordVerified = await this.password.verify(
      password,
      user.password,
    );

    if (!passwordVerified) {
      return Result.failure({
        code: "INVALID_CREDENTIALS",
      });
    }

    return Result.ok(undefined);
  }
}
