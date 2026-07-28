// @file bounded-contexts/iam/application/use-cases/sign-in/sign-in.codes.ts

export const SignInErrorCodes = {
  invalidCredentials: {
    code: "user.invalid_credentials",
  },

  userSuspended: {
    code: "user.suspended",
  },
} as const;
