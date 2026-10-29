import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { UserQueryRepository } from "#ports/user-query.repository";

import type {
  GetUserAdministrationOverview,
  GetUserAdministrationOverviewInput,
  GetUserAdministrationOverviewOutput,
} from "./get-user-administration-overview.contracts.js";

export class GetUserAdministrationOverviewUseCase implements GetUserAdministrationOverview {
  constructor(
    private readonly authorizer: AdministratorAuthorizer,
    private readonly userQuery: UserQueryRepository,
  ) {}

  async execute(
    input: GetUserAdministrationOverviewInput,
  ): Promise<GetUserAdministrationOverviewOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    return {
      success: true,
      value: await this.userQuery.getAdministrationOverview(),
    };
  }
}
