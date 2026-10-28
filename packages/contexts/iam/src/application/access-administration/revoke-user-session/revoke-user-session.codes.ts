export const RevokeUserSessionErrorCodes = {
  featureDisabled: { code: "session.feature_disabled" },
  invalidUserId: { code: "user.invalid_id" },
  invalidSessionId: { code: "session.invalid_id" },
  userNotFound: { code: "user.not_found" },
  sessionNotFound: { code: "session.not_found" },
} as const;
