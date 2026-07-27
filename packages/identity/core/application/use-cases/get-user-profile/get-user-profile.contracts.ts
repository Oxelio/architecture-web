// @file bounded-contexts/identity/application/use-cases/get-user-profile/get-user-profile.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { GetUserProfileErrorCodes } from "./get-user-profile.codes.js";

export type GetUserProfileError = ValueOf<typeof GetUserProfileErrorCodes>;

export interface GetUserProfileInput {
  userId: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  isEmailVerified: boolean;
  role: "user" | "admin";
}

export type GetUserProfileOutput = Result<UserProfile, GetUserProfileError>;

export interface GetUserProfile {
  execute(command: GetUserProfileInput): Promise<GetUserProfileOutput>;
}
