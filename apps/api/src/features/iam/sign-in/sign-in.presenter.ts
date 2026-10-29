// @file apps/api/src/features/iam/sign-in/sign-in.presenter.ts

import type { SignInOutput } from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { SignInHttpContract } from "./sign-in.http.js";

const toHttpError = createHttpErrorMapper(SignInHttpContract.errors);
export const SignInPresenter = {
  toPresentation(result: SignInOutput) {
    if (result.success) {
      if ("mfaRequired" in result.value) {
        return {
          status: 202,
          body: {
            data: {
              mfaRequired: true,
              challengeId: result.value.challengeId,
              expiresAt: result.value.expiresAt.toISOString(),
            },
          },
        };
      }
      return SignInHttpContract.success["user.authenticated"];
    }

    return toHttpError(result.error);
  },
};
