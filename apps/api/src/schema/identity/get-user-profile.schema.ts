import {
  GetUserProfileHttpErrors,
  GetUserProfileHttpSuccess,
} from "#presentation/get-user-profile.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";

export const getUserProfileSchema = {
  tags: ["Identity"],

  summary: "Get user profile",

  response: {
    ...createHttpSuccessResponseSchemas(GetUserProfileHttpSuccess),

    ...createErrorResponseSchemas(GetUserProfileHttpErrors),
  },
};
