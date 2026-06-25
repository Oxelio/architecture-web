import { Entity } from "@architecture/foundation";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import type { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { EmailValueObject } from "#value-objects/email.value-object";

interface UserProperties {
  readonly identifier: UserIdentifierValueObject;
  readonly email: EmailValueObject;
  readonly password: PasswordHashValueObject;
}

interface UserCreationProperties {
  readonly email: EmailValueObject;
  readonly password: PasswordHashValueObject;
}

export class UserEntity extends Entity<UserProperties> {
  static create(properties: UserCreationProperties): UserEntity {
    return new UserEntity({
      ...properties,
      identifier: UserIdentifierValueObject.generate(),
    });
  }

  static rehydrate(props: UserProperties): UserEntity {
    return new UserEntity(props);
  }

  get password(): PasswordHashValueObject {
    return this.props.password;
  }

  get email(): EmailValueObject {
    return this.props.email;
  }
}
