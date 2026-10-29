export const ResendEmailVerificationErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  userNotFound: {
    code: "user.not_found",
  },

  alreadyVerified: {
    code: "email_verification.already_verified",
  },

  tooManyRequests: {
    code: "email_verification.too_many_requests",
  },
} as const;
