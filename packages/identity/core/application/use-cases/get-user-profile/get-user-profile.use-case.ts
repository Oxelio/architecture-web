// @file bounded-contexts/identity/application/use-cases/get-user-profile/get-user-profile.use-case.ts

import { Result } from "@architecture/foundation";

import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { GetUserProfileErrorCodes } from "./get-user-profile.codes.js";
import type {
  GetUserProfile,
  GetUserProfileInput,
  GetUserProfileOutput,
  UserProfile,
} from "./get-user-profile.contracts.js";

export class GetUserProfileUseCase implements GetUserProfile {
  constructor(private readonly user: UserRepository) {}

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
      role: user.role.value,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return Result.success(data);
  }
}
