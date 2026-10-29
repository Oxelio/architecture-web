export const SuspendUserErrors = {
  lastActiveAdministrator: { code: "administrator.last_active_access" },
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
