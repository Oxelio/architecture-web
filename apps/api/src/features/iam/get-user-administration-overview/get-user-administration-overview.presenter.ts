import type { GetUserAdministrationOverviewOutput } from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { GetUserAdministrationOverviewHttpContract } from "./get-user-administration-overview.http.js";

const toHttpError = createHttpErrorMapper(
  GetUserAdministrationOverviewHttpContract.errors,
);

export const GetUserAdministrationOverviewPresenter = {
  toPresentation(result: GetUserAdministrationOverviewOutput) {
    if (!result.success) {
      return toHttpError(result.error);
    }

    return {
      ...GetUserAdministrationOverviewHttpContract.success[
        "users.overview_retrieved"
      ],
      body: { data: result.value },
    };
  },
};
