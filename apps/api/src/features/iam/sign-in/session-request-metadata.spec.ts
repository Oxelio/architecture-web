import { describe, expect, it } from "vitest";

import { parseSessionClient } from "./session-request-metadata.js";

describe("parseSessionClient", () => {
  it("identifies a desktop browser and operating system", () => {
    expect(
      parseSessionClient(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      ),
    ).toMatchObject({
      type: "browser",
      name: "Chrome",
      version: "126.0.0.0",
      deviceType: "desktop",
      operatingSystem: { name: "Windows", version: "10.0" },
    });
  });

  it("identifies a custom application", () => {
    expect(parseSessionClient("ArchitectureMobile/3.2")).toEqual({
      type: "application",
      name: "ArchitectureMobile",
      version: "3.2",
      deviceType: "unknown",
    });
  });

  it("uses explicit unknown values when the user agent is absent", () => {
    expect(parseSessionClient()).toEqual({
      type: "unknown",
      deviceType: "unknown",
    });
  });
});
