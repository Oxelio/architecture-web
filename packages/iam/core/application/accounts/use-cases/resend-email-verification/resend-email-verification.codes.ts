// @file bounded-contexts/iam/application/use-cases/resend-email-verification/resend-email-verification.codes.ts

export const ResendEmailVerificationErrorCodes = {
  invalidId: {
    code: "user.invalid_id",
  },

  userNotFound: {
    code: "user.not_found",
  },

  alreadyVerified: {
    code: "user.email_already_verified",
  },

  tooManyRequests: {
    code: "email_verification.too_many_requests",
  },
} as const;
