// @file bounded-contexts/identity/application/use-cases/suspend-user/suspend-user.codes.ts

export const SuspendUserErrorCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;
