export const ChangeEmailErrors = {
  lastActiveAdministrator: { code: "administrator.last_active_access" },
  featureDisabled: {
    code: "email_change.disabled",
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
