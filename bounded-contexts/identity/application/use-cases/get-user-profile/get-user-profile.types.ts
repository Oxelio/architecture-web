// @file bounded-contexts/identity/application/use-cases/get-user-profile/get-user-profile.types.ts
import type { ApplicationResult, ValueOf } from "@architecture/foundation";

import type {
  GetUserProfileErrorCodes,
  GetUserProfileSuccessCodes,
} from "./get-user-profile.codes.js";

export interface GetUserProfileInput {
  userId: string;
}

export type GetUserProfileSuccess = ValueOf<typeof GetUserProfileSuccessCodes>;
export type GetUserProfileError = ValueOf<typeof GetUserProfileErrorCodes>;

export interface UserProfile {
  userId: string;
  email: string;
  isEmailVerified: boolean;
}

export type GetUserProfileOutput = ApplicationResult<
  GetUserProfileSuccess["code"],
  UserProfile,
  GetUserProfileError
>;
