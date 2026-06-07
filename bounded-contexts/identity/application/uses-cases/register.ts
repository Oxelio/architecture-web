import type { PasswordHasherContract } from "#contracts/password-hasher";
import type { UserContract } from "#contracts/user";
import type { RegisterRequestDTO } from "#dtos/register-request";
import { User } from "#entities/user";

export class Register {
  constructor(
    private readonly user: UserContract,
    private readonly password: PasswordHasherContract,
  ) {}

  async execute(payload: RegisterRequestDTO): Promise<void> {
    const hashedPassword = await this.password.hash(payload.password);

    const user = User.create({
      email: payload.email,
      password: hashedPassword,
    });

    await this.user.save(user);
  }
}
