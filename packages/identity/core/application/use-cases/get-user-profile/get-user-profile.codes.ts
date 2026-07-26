// @file bounded-contexts/identity/application/use-cases/get-user-profile/get-user-profile.codes.ts

export const GetUserProfileErrorCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;
