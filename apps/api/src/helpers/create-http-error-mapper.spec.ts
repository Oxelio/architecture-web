import { describe, expect, it } from "vitest";

import { createHttpErrorMapper } from "./create-http-error-mapper.js";

describe("createHttpErrorMapper", () => {
  const mapError = createHttpErrorMapper({
    "user.not_found": {
      code: "USER_NOT_FOUND",
      status: 404,
      message: "User not found",
    },
  });

  it("maps known application errors", () => {
    expect(mapError({ code: "user.not_found" })).toEqual({
      status: 404,
      body: { error: { code: "USER_NOT_FOUND", message: "User not found" } },
    });
  });

  it("hides unknown application errors behind a 500 response", () => {
    expect(mapError({ code: "unexpected" })).toEqual({
      status: 500,
      body: {
        error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" },
      },
    });
  });
});
