import type { Result } from "@architecture/foundation";

export interface GetCurrentUserProfileError {
  kind: "not_found";
}

export interface GetCurrentUserProfileResponse {
  userId: string;
  email: string;
}

export type GetCurrentUserProfileResult = Result<
  GetCurrentUserProfileResponse,
  GetCurrentUserProfileError
>;
