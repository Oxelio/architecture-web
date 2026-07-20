// @file bounded-contexts/identity/application/use-cases/suspend-user/suspend-user.codes.ts
const SuspendUserSuccessCodes = {
  suspended: {
    code: "user.suspended",
  },
} as const;

const SuspendUserErrorCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export { SuspendUserErrorCodes, SuspendUserSuccessCodes };
