// @file bounded-contexts/identity/application/ports/user.port.ts

import type { UserEntity } from "#entities/user.entity";
import type { EmailValueObject } from "#value-objects/email.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export abstract class UserPort {
  abstract save(user: UserEntity): Promise<void>;
  abstract findByEmail(email: EmailValueObject): Promise<UserEntity | null>;
  abstract findById(id: UserIdentifierValueObject): Promise<UserEntity | null>;
}
