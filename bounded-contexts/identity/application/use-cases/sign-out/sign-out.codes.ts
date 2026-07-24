// @file bounded-contexts/identity/application/use-cases/sign-out/sign-out.codes.ts

export const SignOutErrorCodes = {
  invalidSessionId: {
    code: "session.invalid_id",
  },
} as const;
