import type { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export abstract class PasswordAuthenticatorRepository {
  abstract save(authenticator: PasswordAuthenticatorEntity): Promise<void>;

  /** Records use only while the verified credential remains authoritative. */
  abstract recordSuccessfulUse(
    authenticator: PasswordAuthenticatorEntity,
    usedAt: Date,
  ): Promise<boolean>;

  abstract findForUser(
    userId: UserIdentifierValueObject,
  ): Promise<PasswordAuthenticatorEntity | null>;
}
