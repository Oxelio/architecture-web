// @file bounded-contexts/identity/application/use-cases/activate-user/activate-user.codes.ts
const ActivateUserSuccessCodes = {
  activated: {
    code: "user.activated",
  },
} as const;

const ActivateUserErrorsCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export { ActivateUserErrorsCodes, ActivateUserSuccessCodes };
