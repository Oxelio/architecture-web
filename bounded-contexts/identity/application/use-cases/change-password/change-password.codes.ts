// @file bounded-contexts/identity/application/use-cases/change-password/change-password.codes.ts

export const ChangePasswordErrorsCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;
