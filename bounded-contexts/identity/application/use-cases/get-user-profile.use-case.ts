import type { UserPort } from "#application/ports/user.port";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { Result } from "@architecture/foundation";

export interface GetUserProfileInput {
  userId: string;
}

export interface GetUserProfileError {
  kind: "not_found";
}

export interface GetUserProfileResponse {
  userId: string;
  email: string;
}

export type GetUserProfileResult = Result<
  GetUserProfileResponse,
  GetUserProfileError
>;

export class GetUserProfileUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: GetUserProfileInput): Promise<GetUserProfileResult> {
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
