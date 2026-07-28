// @file bounded-contexts/iam/application/use-cases/get-current-account/get-current-account.codes.ts

export const GetCurrentAccountErrorCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;
