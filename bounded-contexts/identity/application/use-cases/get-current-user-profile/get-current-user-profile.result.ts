import type { Result } from "@architecture/foundation";

export type GetCurrentUserProfileError = {
  kind: "not_found";
};

export interface GetCurrentUserProfileResponse {
  userId: string;
  email: string;
}

export type GetCurrentUserProfileResult = Result<
  GetCurrentUserProfileResponse,
  GetCurrentUserProfileError
>;
