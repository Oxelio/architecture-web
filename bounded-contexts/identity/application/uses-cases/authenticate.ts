import type { PasswordHasherContract } from "#contracts/password-hasher";
import type { UserContract } from "#contracts/user";
import type { AuthenticationRequestDTO } from "#dtos/authentication-request";

export class Authenticate {
  constructor(
    private readonly user: UserContract,
    private readonly password: PasswordHasherContract,
  ) {}

  async execute(payload: AuthenticationRequestDTO): Promise<void> {
    const user = await this.user.findByEmail(payload.email);

    if (!user) {
      this.password.fakeVerify();
      return;
    }

    this.password.verify(payload.password, user.password);
  }
}
