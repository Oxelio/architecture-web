// @file bounded-contexts/iam/application/use-cases/change-email/change-email.codes.ts

export const ChangeEmailErrorsCodes = {
  lastActiveAdministrator: { code: "LAST_ACTIVE_ADMIN" },
  featureDisabled: {
    code: "feature.disabled",
  },
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
