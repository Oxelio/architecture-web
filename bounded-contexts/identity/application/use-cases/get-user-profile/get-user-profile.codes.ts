// @file bounded-contexts/identity/application/use-cases/get-user-profile/get-user-profile.codes.ts
const GetUserProfileSuccessCodes = {
  retrieved: {
    code: "user.profile_retrieved",
  },
} as const;

const GetUserProfileErrorCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export { GetUserProfileErrorCodes, GetUserProfileSuccessCodes };
