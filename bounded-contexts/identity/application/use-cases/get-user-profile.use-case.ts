// @file bounded-contexts/identity/application/use-cases/get-user-profile.use-case.ts

import { type ErrorOf, Result } from "@architecture/foundation";

import type { UserPort } from "#application/ports/user.port";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface GetUserProfileInput {
  userId: string;
}

const GetUserProfileErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export type GetUserProfileError = ErrorOf<typeof GetUserProfileErrors>;

export interface GetUserProfileResponse {
  userId: string;
  email: string;
  isEmailVerified: boolean;
}

export type GetUserProfileResult = Result<
  GetUserProfileResponse,
  GetUserProfileError
>;

export class GetUserProfileUseCase {
  constructor(private readonly user: UserPort) {}

  public async execute(
    payload: GetUserProfileInput,
  ): Promise<GetUserProfileResult> {
    const userIdentifier = UserIdentifierValueObject.create(payload.userId);
    if (!userIdentifier.success) {
      return Result.failure(GetUserProfileErrors.invalidId);
    }

    const user = await this.user.findById(userIdentifier.value);
    if (!user) {
      return Result.failure(GetUserProfileErrors.notFound);
    }

    return Result.ok({
      userId: user.identifier.value,
      email: user.email.value,
      isEmailVerified: user.isEmailVerified,
    });
  }
}
