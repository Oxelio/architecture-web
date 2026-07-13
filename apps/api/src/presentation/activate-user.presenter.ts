import type {
  ActivateUserError,
  ActivateUserResult,
} from "@architecture/identity/application";
import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "./http.types.js";
import { createHttpErrorMapper } from "#schema/http-error-schema";

export const ActivateUserHttpErrors = {
  "user.invalid_id": {
    status: 400 as const,
    code: "INVALID_USER_ID",
    message: "Invalid user identifier",
  },

  "user.not_found": {
    status: 404 as const,
    code: "USER_NOT_FOUND",
    message: "User not found",
  },
} satisfies HttpErrorDefinitions<ActivateUserError["code"]>;

export const ActivateUserHttpSuccess = {
  activated: {
    status: 204 as const,
    description: "User activated successfully",
  },
} satisfies HttpSuccessDefinitions<"activated">;

const toHttpError = createHttpErrorMapper(ActivateUserHttpErrors);

export const ActivateUserPresenter = {
  toPresentation(result: ActivateUserResult) {
    if (result.success) {
      return {
        status: ActivateUserHttpSuccess.activated.status,
      };
    }

    return toHttpError(result.error);
  },
};
