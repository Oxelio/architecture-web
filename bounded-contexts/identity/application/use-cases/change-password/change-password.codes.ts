// @file bounded-contexts/identity/application/use-cases/change-password/change-password.codes.ts
const ChangePasswordSuccessCodes = {
  changed: {
    code: "user.password_changed",
  },
} as const;

const ChangePasswordErrorsCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export { ChangePasswordErrorsCodes, ChangePasswordSuccessCodes };
