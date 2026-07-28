// @file bounded-contexts/iam/application/use-cases/suspend-user/suspend-user.codes.ts

export const SuspendUserErrorCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },

  selfOperation: {
    code: "user.self_administration_forbidden",
  },
} as const;
