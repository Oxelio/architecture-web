import type { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export abstract class PasswordAuthenticatorRepository {
  abstract save(authenticator: PasswordAuthenticatorEntity): Promise<void>;

  abstract findForUser(
    userId: UserIdentifierValueObject,
  ): Promise<PasswordAuthenticatorEntity | null>;
}
