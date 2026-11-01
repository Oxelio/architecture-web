import { describe, expect, it } from "vitest";

import { parseSessionClient } from "./session-request-metadata.js";

describe("parseSessionClient", () => {
  it.each([
    [
      "Mozilla/5.0 (Android 15; Mobile) Chrome/126.0",
      "Android",
      "phone",
      "Chrome",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 18_1) Version/18.1 Safari/1",
      "iOS",
      "tablet",
      "Safari",
    ],
    [
      "Mozilla/5.0 (Mac OS X 14_5) Version/17.5 Safari/1",
      "macOS",
      "desktop",
      "Safari",
    ],
    ["Mozilla/5.0 (Linux) Firefox/128.0", "Linux", "desktop", "Firefox"],
    [
      "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 Edg/126.1",
      "Windows",
      "desktop",
      "Edge",
    ],
  ])("preserves browser/OS priority for %s", (agent, os, device, browser) => {
    expect(parseSessionClient(agent)).toMatchObject({
      name: browser,
      deviceType: device,
      operatingSystem: { name: os },
    });
  });
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
