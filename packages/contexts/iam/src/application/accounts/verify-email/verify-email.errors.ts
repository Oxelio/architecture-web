export const VerifyEmailErrors = {
  userNotFound: {
    code: "user.not_found",
  },

  tokenInvalid: {
    code: "email_verification.invalid_token",
  },

  tokenExpired: {
    code: "email_verification.expired_token",
  },
} as const;
