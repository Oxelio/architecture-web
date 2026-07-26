// @file bounded-contexts/identity/application/use-cases/verify-email/verify-email.codes.ts

export const VerifyEmailErrorCodes = {
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
