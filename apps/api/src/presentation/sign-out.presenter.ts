// @file apps/api/src/presentation/sign-out.presenter.ts

import type { SignOutResult } from "@architecture/identity/application";
import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "./http.types.js";
import { createHttpErrorMapper } from "#schema/http-error-schema";

export const SignOutHttpErrors = {
  invalid_session_id: {
    status: 400 as const,
    code: "INVALID_SESSION_ID",
    message: "Invalid session identifier",
  },
} satisfies HttpErrorDefinitions<"invalid_session_id">;

export const SignOutHttpSuccess = {
  signedOut: {
    status: 204 as const,
    description: "User signed out successfully",
  },
} satisfies HttpSuccessDefinitions<"signedOut">;

const toHttpError = createHttpErrorMapper(SignOutHttpErrors);

export const SignOutPresenter = {
  toPresentation(result: SignOutResult) {
    if (result.success) {
      return {
        status: SignOutHttpSuccess.signedOut.status,
      };
    }

    return toHttpError(result.error);
  },
};
