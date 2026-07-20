// @file bounded-contexts/identity/application/use-cases/get-user-profile/get-user-profile.use-case.ts

import { Result } from "@architecture/foundation";

import type { UserPort } from "#application/ports/user.port";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  GetUserProfileErrorCodes,
  GetUserProfileSuccessCodes,
} from "./get-user-profile.codes.js";
import type {
  GetUserProfileInput,
  GetUserProfileOutput,
  UserProfile,
} from "./get-user-profile.types.js";

export class GetUserProfileUseCase {
  constructor(private readonly user: UserPort) {}

  public async execute(
    payload: GetUserProfileInput,
  ): Promise<GetUserProfileOutput> {
    const userIdentifier = UserIdentifierValueObject.create(payload.userId);
    if (!userIdentifier.success) {
      return Result.failure(GetUserProfileErrorCodes.invalidId);
    }

    const user = await this.user.findById(userIdentifier.value);
    if (!user) {
      return Result.failure(GetUserProfileErrorCodes.notFound);
    }

    const data: UserProfile = {
      userId: user.identifier.value,
      email: user.email.value,
      isEmailVerified: user.isEmailVerified,
    };

    return Result.success({
      code: GetUserProfileSuccessCodes.retrieved.code,
      data,
    });
  }
}
