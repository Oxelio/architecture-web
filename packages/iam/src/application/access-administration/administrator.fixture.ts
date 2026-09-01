import { UserEntity } from "#entities/user.entity";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

export function createAdministrator(): UserEntity {
  const administrator = UserEntity.create();
  administrator.changeRole(UserRoleValueObject.admin());
  return administrator;
}
