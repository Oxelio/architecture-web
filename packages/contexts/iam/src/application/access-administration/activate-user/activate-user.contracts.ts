import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";

export const ActivateUserErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export type ActivateUserError =
  ValueOf<typeof ActivateUserErrors> | AdministratorAuthorizationError;

export interface ActivateUserInput {
  readonly actorUserId: string;
  readonly userId: string;
}

export type ActivateUserOutput = Result<void, ActivateUserError>;

export interface ActivateUser {
  execute(command: ActivateUserInput): Promise<ActivateUserOutput>;
}
