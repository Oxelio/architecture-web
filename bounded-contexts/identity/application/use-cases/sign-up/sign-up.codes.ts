// @file bounded-contexts/identity/application/use-cases/sign-up/sign-up.codes.ts

export const SignUpErrorCodes = {
  userAlreadyExists: {
    code: "user.already_exists",
  },
} as const;
