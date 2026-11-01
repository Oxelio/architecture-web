import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "../App";
import { SecurityCenter } from "../components/SecurityCenter";
import type { CurrentUser, CurrentUserSession } from "../services/api";
import { AdminPage } from "./AdminPage";
import { NotificationsPage } from "./NotificationsPage";
import { ProfilePage } from "./ProfilePage";
import { RecoveryPage } from "./RecoveryPage";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
    i18n: { language: "en", changeLanguage: () => Promise.resolve() },
  }),
}));

const user: CurrentUser = {
  userId: "account",
  email: "member@example.invalid",
  isEmailVerified: true,
  role: "user",
  loginIdentifiers: [
    {
      kind: "email",
      value: "member@example.invalid",
      verificationStatus: "verified",
    },
  ],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const session: CurrentUserSession = {
  sessionId: "session",
  createdAt: user.createdAt,
  lastActivityAt: user.updatedAt,
  expiresAt: user.updatedAt,
  isCurrent: true,
  client: {
    type: "browser",
    name: "Firefox",
    version: "1",
    deviceType: "desktop",
    operatingSystem: null,
  },
  network: { ipAddress: "127.0.0.1", location: null },
};
const userKey = [
  "admin",
  "users",
  {
    search: undefined,
    role: undefined,
    status: undefined,
    emailVerified: undefined,
    page: 1,
    pageSize: 25,
  },
];

function renderPage(
  element: ReactElement,
  configure: (client: QueryClient) => void,
  path = "/",
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        gcTime: Infinity,
      },
    },
  });
  for (const key of [
    "account-exports",
    "security-events",
    "admin-security-events",
    "notification-preferences",
  ]) {
    client.setQueryData([key], []);
  }
  client.setQueryData(["mfa"], { enabled: false, backupCodesRemaining: 0 });
  configure(client);
  try {
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
      </QueryClientProvider>,
    );
  } finally {
    client.clear();
  }
}

function queryState(
  client: QueryClient,
  key: readonly unknown[],
  state: "loading" | "error" | "empty",
  empty: unknown = [],
) {
  if (state === "empty") {
    client.setQueryData(key, empty);
    return;
  }
  client
    .getQueryCache()
    .build(client, { queryKey: key })
    .setState(
      state === "error"
        ? {
            status: "error",
            error: new Error("Unavailable"),
            fetchStatus: "idle",
          }
        : { status: "pending", fetchStatus: "fetching" },
    );
}

describe("profile presentation states", () => {
  it("does not request email verification for a username-only account", () => {
    const html = renderPage(
      <ProfilePage
        user={{
          ...user,
          email: null,
          isEmailVerified: false,
          loginIdentifiers: [
            {
              kind: "username",
              value: "member",
              verificationStatus: "not_required",
            },
          ],
        }}
      />,
      (client) => client.setQueryData(["currentUserSessions"], []),
    );
    expect(html).not.toContain("profile.verificationCalloutTitle");
    expect(html).toContain("member");
  });
  it.each([true, false])(
    "preserves native MFA controls for enabled=%s",
    (enabled) => {
      const html = renderPage(<SecurityCenter />, (client) =>
        client.setQueryData(["mfa"], { enabled, backupCodesRemaining: 3 }),
      );
      expect(html).toContain(
        enabled ? "Désactiver le MFA" : "Configurer le MFA",
      );
    },
  );
  it.each(["loading", "error", "empty"] as const)(
    "preserves the %s session state",
    (state) => {
      const html = renderPage(<ProfilePage user={user} />, (client) =>
        queryState(client, ["currentUserSessions"], state),
      );
      expect(html).toContain(
        {
          loading: "profile.sessionsLoading",
          error: "profile.sessionsError",
          empty: "profile.noSessions",
        }[state],
      );
    },
  );
  it.each([true, false])(
    "renders session controls and email verification=%s",
    (verified) => {
      const html = renderPage(
        <ProfilePage user={{ ...user, isEmailVerified: verified }} />,
        (client) => client.setQueryData(["currentUserSessions"], [session]),
      );
      expect(html).toContain("Firefox");
      expect(html).toContain("profile.revokeSession");
      expect(html.includes("profile.verificationCalloutTitle")).toBe(!verified);
    },
  );
});

describe("notification presentation states", () => {
  it.each(["loading", "error", "empty"] as const)(
    "preserves the %s list state",
    (state) => {
      const html = renderPage(<NotificationsPage />, (client) =>
        queryState(client, ["notifications"], state),
      );
      expect(html).toContain(
        {
          loading: "common.loading",
          error: "notifications.error",
          empty: "notifications.empty",
        }[state],
      );
    },
  );
  it("renders unread notification activation without an action URL", () => {
    const html = renderPage(<NotificationsPage />, (client) =>
      client.setQueryData(
        ["notifications"],
        [
          {
            id: "notification",
            title: "Notice",
            message: "Message",
            severity: "warning",
            type: "test",
            createdAt: user.createdAt,
            readAt: null,
            actionUrl: null,
          },
        ],
      ),
    );
    expect(html).toContain("Notice");
    expect(html).toContain('aria-label="notifications.markRead"');
  });
});

describe("administration presentation states", () => {
  it.each(["loading", "error", "empty"] as const)(
    "preserves the %s user state",
    (state) => {
      const html = renderPage(
        <AdminPage currentUserId="administrator" />,
        (client) =>
          queryState(client, userKey, state, {
            users: [],
            pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
          }),
      );
      expect(html).toContain(
        {
          loading: "common.loading",
          error: "admin.loadError",
          empty: "admin.empty",
        }[state],
      );
    },
  );
  it("renders known users and typed configuration values", () => {
    const html = renderPage(
      <AdminPage currentUserId="administrator" />,
      (client) => {
        client.setQueryData(userKey, {
          users: [user],
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        });
        client.setQueryData(["admin-security-config"], {
          effectiveRevision: { id: "revision", version: 1 },
          effective: { accounts: { allowedLoginIdentifiers: ["email"] } },
          revisions: [],
          catalog: [
            {
              key: "accounts.allowedLoginIdentifiers",
              category: "accounts",
              control: "multi-select",
              type: "set",
              impact: "high",
              constraints: { choices: ["email", "username"] },
              recommendedValue: { expected: "email" },
              availability: { available: true, readOnly: false },
            },
          ],
        });
      },
    );
    expect(html).toContain("member@example.invalid");
    expect(html).toContain("allowedLoginIdentifiers");
    expect(html).not.toContain("[object Object]");
  });
});

describe("navigation and recovery presentation", () => {
  it.each([null, user, { ...user, role: "admin" as const }])(
    "preserves navigation for the current account",
    (current) => {
      const html = renderPage(
        <App />,
        (client) => {
          client.setQueryData(["currentUser"], current);
          client.setQueryData(["notification-unread"], { count: 2 });
        },
        "/unknown",
      );
      expect(html.includes("nav.signIn")).toBe(current === null);
      expect(html.includes("nav.admin")).toBe(current?.role === "admin");
      expect(html.includes("nav.notifications")).toBe(current !== null);
    },
  );
  it.each(["/recovery", "/recovery?token=example"])(
    "preserves request/reset form at %s",
    (path) => {
      const html = renderPage(<RecoveryPage />, () => undefined, path);
      expect(html.includes('type="password"')).toBe(path.includes("token="));
      expect(html.includes('type="email"')).toBe(!path.includes("token="));
    },
  );
});
