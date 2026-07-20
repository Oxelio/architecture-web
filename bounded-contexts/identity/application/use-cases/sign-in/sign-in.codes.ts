// @file bounded-contexts/identity/application/use-cases/sign-in/sign-in.codes.ts
const SignInSuccessCodes = {
  authenticated: {
    code: "user.authenticated",
  },
} as const;

const SignInErrorCodes = {
  invalidCredentials: {
    code: "user.invalid_credentials",
  },

  userSuspended: {
    code: "user.suspended",
  },
} as const;

export { SignInErrorCodes, SignInSuccessCodes };
