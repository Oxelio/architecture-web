export const RevokeCurrentUserSessionErrorCodes = {
  invalidActorId: { code: "user.invalid_id" },
  invalidSessionId: { code: "session.invalid_id" },
  sessionNotFound: { code: "session.not_found" },
} as const;
