import type { Email } from "#value-objects/email";
import type { PasswordPlain } from "#value-objects/password-plain";

export class AuthenticationRequestDTO {
  constructor(
    public readonly email: Email,
    public readonly password: PasswordPlain,
  ) {}
}
