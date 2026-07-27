import type { Result, ValueOf } from "@architecture/foundation";

import type { UserRoleError } from "#value-objects/user-role.value-object";

import type { AssignUserRoleErrorCodes } from "./assign-user-role.codes.js";

export type AssignUserRoleError =
  UserRoleError | ValueOf<typeof AssignUserRoleErrorCodes>;

export interface AssignUserRoleInput {
  readonly userId: string;
  readonly actorUserId?: string;
  readonly role: string;
}

export type AssignUserRoleOutput = Result<void, AssignUserRoleError>;

export interface AssignUserRole {
  execute(command: AssignUserRoleInput): Promise<AssignUserRoleOutput>;
}
