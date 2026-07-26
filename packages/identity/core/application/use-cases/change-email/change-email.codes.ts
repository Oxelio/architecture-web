// @file bounded-contexts/identity/application/use-cases/change-email/change-email.codes.ts

export const ChangeEmailErrorsCodes = {
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
