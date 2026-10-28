// @file bounded-contexts/iam/application/ports/user.port.ts

import type { UserEntity } from "#entities/user.entity";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export abstract class UserRepository {
  abstract save(user: UserEntity): Promise<void>;
  abstract hasOtherAdministrativeAccess(
    excluding: UserIdentifierValueObject,
  ): Promise<boolean>;
  abstract findById(id: UserIdentifierValueObject): Promise<UserEntity | null>;
}
