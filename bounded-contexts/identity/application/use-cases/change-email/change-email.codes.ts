// @file bounded-contexts/identity/application/use-cases/change-email/change-email.codes.ts
const ChangeEmailSuccessCodes = {
  changed: {
    code: "user.email_changed",
  },
} as const;

const ChangeEmailErrorsCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },

  userAlreadyExists: {
    code: "user.already_exists",
  },
} as const;

export { ChangeEmailErrorsCodes, ChangeEmailSuccessCodes };
