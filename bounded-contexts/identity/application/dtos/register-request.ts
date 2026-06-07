import type { Email } from "#value-objects/email";
import type { PasswordPlain } from "#value-objects/password-plain";

export class RegisterRequestDTO {
  constructor(
    public readonly email: Email,
    public readonly password: PasswordPlain,
  ) {}
}
