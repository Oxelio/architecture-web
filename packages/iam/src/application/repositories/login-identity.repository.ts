import type { LoginIdentityEntity } from "#entities/login-identity.entity";
import type {
  LoginIdentifierKind,
  LoginIdentifierValueObject,
} from "#value-objects/login-identifier.value-object";
import type { LoginIdentityIdentifierValueObject } from "#value-objects/login-identity-identifier.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export abstract class LoginIdentityRepository {
  abstract save(identity: LoginIdentityEntity): Promise<void>;

  abstract findById(
    id: LoginIdentityIdentifierValueObject,
  ): Promise<LoginIdentityEntity | null>;

  abstract findByLogin(
    login: LoginIdentifierValueObject,
  ): Promise<LoginIdentityEntity | null>;

  abstract findForUser(
    userId: UserIdentifierValueObject,
    kind: LoginIdentifierKind,
  ): Promise<LoginIdentityEntity | null>;

  abstract listForUser(
    userId: UserIdentifierValueObject,
  ): Promise<readonly LoginIdentityEntity[]>;
}
