// @file bounded-contexts/iam/application/use-cases/sign-up/sign-up.codes.ts

export const SignUpErrorCodes = {
  featureDisabled: {
    code: "feature.disabled",
  },
  userAlreadyExists: {
    code: "user.already_exists",
  },
  loginIdentifierNotAllowed: {
    code: "login_identifier.not_allowed",
  },
} as const;
