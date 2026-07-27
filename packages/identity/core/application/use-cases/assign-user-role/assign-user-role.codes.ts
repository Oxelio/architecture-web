export const AssignUserRoleErrorCodes = {
  invalidId: { code: "user.invalid_id" },
  notFound: { code: "user.not_found" },
  selfOperation: { code: "user.self_administration_forbidden" },
} as const;
