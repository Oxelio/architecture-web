import type {
  ConfirmMfaEnrollmentOutput,
  GetMfaStatusOutput,
} from "@architecture/iam/application";
import type { FastifyReply } from "fastify";
import { describe, expectTypeOf, it } from "vitest";

import { ConfirmMfaEnrollmentHttpErrors } from "./security.http.js";
import { applicationResponse } from "./security.routes.js";

describe("security HTTP mapping types", () => {
  it("requires complete mappings without widening the operation's error union", () => {
    // Compiled by the API typecheck, never invoked with a fake Fastify reply.
    const check = (
      reply: FastifyReply,
      result: ConfirmMfaEnrollmentOutput,
      infallible: GetMfaStatusOutput,
    ) => {
      const mapping = ConfirmMfaEnrollmentHttpErrors;
      applicationResponse(reply, result, mapping);
      applicationResponse(reply, infallible, {});

      // @ts-expect-error A fallible operation requires a mapping.
      applicationResponse(reply, result);
      // @ts-expect-error The table must cover every expected error.
      applicationResponse(reply, result, {});
      const extended = result as
        | ConfirmMfaEnrollmentOutput
        | { success: false; error: { code: "mfa.new_failure" } };
      // @ts-expect-error Adding an operation error requires updating its mapping.
      applicationResponse(reply, extended, mapping);

      const incomplete = {
        "mfa.invalid_code": ConfirmMfaEnrollmentHttpErrors["mfa.invalid_code"],
      };
      // @ts-expect-error A partial table cannot widen or narrow the inferred union.
      applicationResponse(reply, result, incomplete);

      const mismatchedCode = {
        ...ConfirmMfaEnrollmentHttpErrors,
        "mfa.invalid_code": { code: "mfa.invalid_enrollment", status: 400 },
      } as const;
      // @ts-expect-error An entry must retain the code of its key.
      applicationResponse(reply, result, mismatchedCode);

      const invalidStatus = {
        ...ConfirmMfaEnrollmentHttpErrors,
        "mfa.invalid_code": { code: "mfa.invalid_code", status: 418 },
      } as const;
      // @ts-expect-error Only established HTTP error statuses are allowed.
      applicationResponse(reply, result, invalidStatus);

      const unrelated = {
        "mfa.other": { code: "mfa.other", status: 400 },
      } as const;
      // @ts-expect-error A different table cannot widen the operation's codes.
      applicationResponse(reply, result, unrelated);
    };

    expectTypeOf(check).toBeFunction();
  });
});
