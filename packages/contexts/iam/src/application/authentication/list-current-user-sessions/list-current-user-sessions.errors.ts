export const ListCurrentUserSessionsErrors = {
  featureDisabled: { code: "session_management.disabled" },
  invalidActorId: { code: "user.invalid_id" },
  userNotFound: { code: "user.not_found" },
} as const;
