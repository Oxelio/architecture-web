// @file bounded-contexts/identity/application/use-cases/sign-out/sign-out.codes.ts
const SignOutSuccessCodes = {
  signedOut: {
    code: "session.signed_out",
  },
} as const;

const SignOutErrorCodes = {
  invalidSessionId: {
    code: "session.invalid_id",
  },
} as const;

export { SignOutErrorCodes, SignOutSuccessCodes };
