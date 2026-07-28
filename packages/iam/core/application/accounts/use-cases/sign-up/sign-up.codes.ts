// @file bounded-contexts/iam/application/use-cases/sign-up/sign-up.codes.ts

export const SignUpErrorCodes = {
  userAlreadyExists: {
    code: "user.already_exists",
  },
} as const;
