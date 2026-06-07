import { Entity } from "@architecture/foundation";
import type { Email } from "#value-objects/email";
import { UserIdentifier } from "#value-objects/user-identifier";
import type { PasswordHash } from "#value-objects/password-hash";

interface UserProperties {
  readonly identifier: UserIdentifier;
  readonly email: Email;
  readonly password: PasswordHash;
}

interface UserCreationProperties {
  readonly email: Email;
  readonly password: PasswordHash;
}

export class User extends Entity<UserProperties> {
  static create(properties: UserCreationProperties): User {
    return new User({
      ...properties,
      identifier: UserIdentifier.generate(),
    });
  }

  get password(): PasswordHash {
    return this.props.password;
  }

  get email(): Email {
    return this.props.email;
  }
}
