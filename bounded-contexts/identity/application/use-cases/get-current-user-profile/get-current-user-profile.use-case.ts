import type { UserPort } from "#application/ports/user.port";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { Result } from "@architecture/foundation";
import type { GetCurrentUserProfileQuery } from "./get-current-user-profile.query.js";
import type { GetCurrentUserProfileResult } from "./get-current-user-profile.result.js";

export class GetCurrentUserProfileUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(
    command: GetCurrentUserProfileQuery,
  ): Promise<GetCurrentUserProfileResult> {
    const userIdentifier = UserIdentifierValueObject.create(command.userId);
    if (!userIdentifier.success) {
      return Result.failure({
        kind: "not_found",
      });
    }

    const user = await this.userPort.findById(userIdentifier.value);

    if (!user) {
      return Result.failure({
        kind: "not_found",
      });
    }

    return Result.ok({
      userId: user.identifier.value,
      email: user.email.value,
    });
  }
}
