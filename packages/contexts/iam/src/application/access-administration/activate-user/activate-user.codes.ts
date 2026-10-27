// @file bounded-contexts/iam/application/use-cases/activate-user/activate-user.codes.ts

export const ActivateUserErrorsCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;
