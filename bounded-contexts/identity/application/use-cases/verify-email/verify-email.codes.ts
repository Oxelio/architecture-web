// @file bounded-contexts/identity/application/use-cases/verify-email/verify-email.codes.ts
const VerifyEmailSuccessCodes = {
  verified: {
    code: "user.email_verified",
  },
} as const;

const VerifyEmailErrorCodes = {
  userNotFound: {
    code: "user.not_found",
  },

  tokenInvalid: {
    code: "token.invalid",
  },

  tokenExpired: {
    code: "token.expired",
  },
} as const;

export { VerifyEmailErrorCodes, VerifyEmailSuccessCodes };
