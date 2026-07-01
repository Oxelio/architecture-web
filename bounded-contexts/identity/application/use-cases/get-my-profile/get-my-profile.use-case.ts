import type { UserPort } from "#application/ports/user.port";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { Result } from "@architecture/foundation";

export class GetMyProfileUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(userId: string) {
    const userIdentifier = UserIdentifierValueObject.create(userId);
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
      id: user.identifier.value,
      email: user.email.value,
    });
  }
}
