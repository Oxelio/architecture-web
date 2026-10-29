export const RevokeCurrentUserSessionErrors = {
  featureDisabled: { code: "session_management.disabled" },
  invalidActorId: { code: "user.invalid_id" },
  invalidSessionId: { code: "session.invalid_id" },
  sessionNotFound: { code: "session.not_found" },
} as const;
