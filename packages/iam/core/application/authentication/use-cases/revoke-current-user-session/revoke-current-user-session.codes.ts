export const RevokeCurrentUserSessionErrorCodes = {
  featureDisabled: { code: "feature.disabled" },
  invalidActorId: { code: "user.invalid_id" },
  invalidSessionId: { code: "session.invalid_id" },
  sessionNotFound: { code: "session.not_found" },
} as const;
