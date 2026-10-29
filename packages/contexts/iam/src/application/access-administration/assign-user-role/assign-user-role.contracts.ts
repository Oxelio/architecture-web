import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";
import type { UserRoleError } from "#value-objects/user-role.value-object";

import type { AssignUserRoleErrors } from "./assign-user-role.errors.js";

export type AssignUserRoleError =
  | UserRoleError
  | ValueOf<typeof AssignUserRoleErrors>
  | AdministratorAuthorizationError;

export interface AssignUserRoleInput {
  readonly userId: string;
  readonly actorUserId: string;
  readonly role: string;
}

export type AssignUserRoleOutput = Result<void, AssignUserRoleError>;

export interface AssignUserRole {
  execute(command: AssignUserRoleInput): Promise<AssignUserRoleOutput>;
}
