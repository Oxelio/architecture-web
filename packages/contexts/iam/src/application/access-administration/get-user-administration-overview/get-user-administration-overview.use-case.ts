import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { UserRepository } from "#repositories/user.repository";
import type { UserQueryRepository } from "#repositories/user-query.repository";

import type {
  GetUserAdministrationOverview,
  GetUserAdministrationOverviewInput,
  GetUserAdministrationOverviewOutput,
} from "./get-user-administration-overview.contracts.js";

export class GetUserAdministrationOverviewUseCase implements GetUserAdministrationOverview {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(
    users: UserRepository,
    private readonly userQuery: UserQueryRepository,
  ) {
    this.authorizer = new AdministratorAuthorizer(users);
  }

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
