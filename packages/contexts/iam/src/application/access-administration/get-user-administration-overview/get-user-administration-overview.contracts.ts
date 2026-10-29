import type { Result } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";

export interface UserAdministrationOverview {
  readonly total: number;
  readonly active: number;
  readonly suspended: number;
  readonly administrators: number;
}

export interface GetUserAdministrationOverviewInput {
  readonly actorUserId: string;
}

export type GetUserAdministrationOverviewOutput = Result<
  UserAdministrationOverview,
  AdministratorAuthorizationError
>;

export interface GetUserAdministrationOverview {
  execute(
    input: GetUserAdministrationOverviewInput,
  ): Promise<GetUserAdministrationOverviewOutput>;
}
