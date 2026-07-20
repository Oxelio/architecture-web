// @file bounded-contexts/identity/application/use-cases/sign-up/sign-up.codes.ts
const SignUpSuccessCodes = {
  created: {
    code: "user.created",
  },
} as const;

const SignUpErrorCodes = {
  userAlreadyExists: {
    code: "user.already_exists",
  },
} as const;

export { SignUpErrorCodes, SignUpSuccessCodes };
