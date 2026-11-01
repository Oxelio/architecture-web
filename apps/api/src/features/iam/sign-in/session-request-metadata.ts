import type {
  SessionClient,
  SessionNetwork,
} from "@architecture/iam/application";
import type { FastifyRequest } from "fastify";

const VERSION_PATTERN = /(\d+(?:[._]\d+){0,3})/;

function versionAfter(userAgent: string, marker: string): string | undefined {
  const value = userAgent.slice(userAgent.indexOf(marker) + marker.length);
  return VERSION_PATTERN.exec(value)?.[1]?.replaceAll("_", ".");
}

export function parseSessionClient(userAgent?: string): SessionClient {
  if (!userAgent?.trim()) {
    return { type: "unknown", deviceType: "unknown" };
  }

  const os = sessionOperatingSystem(userAgent);

  const browser = (() => {
    const candidates = [
      ["Edge", "Edg/"],
      ["Chrome", "Chrome/"],
      ["Firefox", "Firefox/"],
      ["Safari", "Version/"],
    ] as const;
    const match = candidates.find(([, marker]) => userAgent.includes(marker));
    return match
      ? { name: match[0], version: versionAfter(userAgent, match[1]) }
      : undefined;
  })();

  const deviceType = sessionDeviceType(userAgent, os !== undefined);

  if (browser) {
    return {
      type: "browser",
      deviceType,
      name: browser.name,
      ...(browser.version ? { version: browser.version } : {}),
      ...(os
        ? {
            operatingSystem: {
              name: os.name,
              ...(os.version ? { version: os.version } : {}),
            },
          }
        : {}),
    };
  }

  const application =
    /^([A-Za-z][A-Za-z0-9 ._-]{1,63})\/(\d+(?:\.\d+){0,3})/.exec(userAgent);
  return {
    type: application ? "application" : "unknown",
    deviceType,
    ...(application?.[1] ? { name: application[1].trim() } : {}),
    ...(application?.[2] ? { version: application[2] } : {}),
    ...(os
      ? {
          operatingSystem: {
            name: os.name,
            ...(os.version ? { version: os.version } : {}),
          },
        }
      : {}),
  };
}

export function sessionMetadataFromRequest(request: FastifyRequest): {
  client: SessionClient;
  network?: SessionNetwork;
} {
  const ipAddress = request.ip?.trim();
  return {
    client: parseSessionClient(request.headers["user-agent"]),
    ...(ipAddress ? { network: { ipAddress } } : {}),
  };
}

function sessionOperatingSystem(userAgent: string) {
  if (userAgent.includes("Windows NT")) {
    return {
      name: "Windows",
      version: versionAfter(userAgent, "Windows NT "),
    };
  }
  if (userAgent.includes("Android")) {
    return {
      name: "Android",
      version: versionAfter(userAgent, "Android "),
    };
  }
  if (/(iPhone|iPad).*OS /.test(userAgent)) {
    return { name: "iOS", version: versionAfter(userAgent, "OS ") };
  }
  if (userAgent.includes("Mac OS X")) {
    return {
      name: "macOS",
      version: versionAfter(userAgent, "Mac OS X "),
    };
  }
  if (userAgent.includes("Linux")) {
    return { name: "Linux" };
  }
  return undefined;
}

function sessionDeviceType(
  userAgent: string,
  hasOperatingSystem: boolean,
): SessionClient["deviceType"] {
  if (/iPad|Tablet/i.test(userAgent)) {
    return "tablet";
  }
  if (/(?:\bMobile(?:\b|\/)|iPhone|Android)/i.test(userAgent)) {
    return "phone";
  }
  return hasOperatingSystem ? "desktop" : "unknown";
}
