import type { PasswordHasherContract } from "#contracts/password-hasher";
import type { UserContract } from "#contracts/user";
import type { RegisterUserCommand } from "../commands/register-user.js";
import { User } from "#entities/user";
import { Result } from "@architecture/foundation";
import type { RegisterResult } from "../errors/register.js";
import { Email, PasswordPlain } from "#value-objects/index";

export class Register {
  constructor(
    private readonly user: UserContract,
    private readonly password: PasswordHasherContract,
  ) {}

  async execute(payload: RegisterUserCommand): Promise<RegisterResult> {
    const email = Email.of(payload.email);
    const password = PasswordPlain.create(payload.password);

    const existingUser = await this.user.findByEmail(email);

    if (existingUser) {
      return Result.failure({
        code: "USER_ALREADY_EXISTS",
      });
    }

    const hashedPassword = await this.password.hash(password);

    const user = User.create({
      email: email,
      password: hashedPassword,
    });

    await this.user.save(user);
    return Result.ok({
      userId: user.identifier.value,
    });
  }
}
