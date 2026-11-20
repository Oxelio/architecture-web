// @vitest-environment jsdom

import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, type ReactElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import i18n, { changeLanguage, type Language } from "#app/i18n";
import { AdminSecurityCenter } from "#components/AdminSecurityCenter";
import type { AdminUser } from "#services/api";

import { AdminPage } from "./AdminPage";
import { CancelDeletionPage } from "./CancelDeletionPage";
import { ProfilePage } from "./ProfilePage";
import { RecoveryPage } from "./RecoveryPage";
import { SignInPage } from "./SignInPage";
import { SignUpPage } from "./SignUpPage";
import { VerifyEmailPage } from "./VerifyEmailPage";

vi.hoisted(() => {
  // Node's Web Storage global can shadow jsdom's storage during i18n initialization.
  const { jsdom } = globalThis as typeof globalThis & {
    jsdom: { window: Pick<Window, "localStorage"> };
  };
  vi.stubGlobal("localStorage", jsdom.window.localStorage);
});

const loginPassword = "12345678";
const newPassword = "a unique registration passphrase";
const privateDetail = "internal traceback with private data";
const user: AdminUser = {
  userId: "member-id",
  email: "member@example.invalid",
  role: "user",
  status: "active",
  loginIdentifiers: [
    {
      kind: "email",
      value: "member@example.invalid",
      verificationStatus: "verified",
    },
  ],
  isEmailVerified: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const fetchApi = vi.fn<typeof fetch>();
let container: HTMLDivElement;
let client: QueryClient;
let root: Root;

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    void act(callback);
  });
});

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchApi);
  fetchApi.mockReset();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["public-capabilities"], {
    publicRegistration: true,
    allowedLoginIdentifiers: ["email"],
  });
  client.setQueryData(["password-policy"], { minLength: 16, maxLength: 48 });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await i18n.changeLanguage("en");
});

afterEach(async () => {
  await act(() => root.unmount());
  client.clear();
  container.remove();
  vi.useRealTimers();
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => callback());
  vi.unstubAllGlobals();
});

async function render(page: ReactElement, path = "/") {
  await act(() => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <MemoryRouter
            initialEntries={[path]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Routes>
              <Route path="/profile" element={<p>Profile destination</p>} />
              <Route path="/signin" element={<p>Sign-in destination</p>} />
              <Route path="*" element={page} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
  });
}

function element<T extends HTMLElement>(selector: string): T {
  const match = container.querySelector<T>(selector);
  if (!match) {
    throw new Error(`Missing element ${selector}`);
  }
  return match;
}

async function enter(selector: string, value: string) {
  const input = element<HTMLInputElement | HTMLTextAreaElement>(selector);
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setValue = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  await act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(() => {
    element("form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

async function click(selector: string) {
  await act(() => element(selector).click());
}

async function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (node) => node.textContent?.trim() === label,
  );
  if (!button) {
    throw new Error(`Missing button ${label}`);
  }
  await act(() => button.click());
}

async function expectFeedback(selector: string, message: string) {
  await vi.waitFor(async () => {
    await act(() => undefined);
    expect(element(selector).textContent).toContain(message);
  });
}

async function changeLocale(locale: Language) {
  await act(() => changeLanguage(locale));
}

function fieldFeedback(name: string) {
  const input = element<HTMLInputElement>(`input[name="${name}"]`);
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const id = input.getAttribute("aria-describedby");
  expect(id).toBeTruthy();
  return document.getElementById(id ?? "")?.textContent;
}

function failure(code: string, status = 400) {
  return Response.json({ error: { code, message: privateDetail } }, { status });
}

async function fillRegistration(identifier = "member@example.invalid") {
  await enter('input[name="loginValue"]', identifier);
  await enter('input[name="password"]', newPassword);
  await enter('input[name="passwordConfirmation"]', newPassword);
}

describe("sign-in feedback", () => {
  it("localizes the required identifier and interpolates the existing password minimum without resubmitting", async () => {
    await render(<SignInPage />);
    await enter('input[name="password"]', "1234567");
    await submit();

    expect(fieldFeedback("loginValue")).toBe("Enter your sign-in identifier.");
    expect(fieldFeedback("password")).toBe(
      "Password must be at least 8 characters long",
    );
    await changeLocale("fr");
    expect(fieldFeedback("loginValue")).toBe(
      "Saisissez votre identifiant de connexion.",
    );
    expect(fieldFeedback("password")).toBe(
      "Le mot de passe doit contenir au moins 8 caractères",
    );
    expect(fetchApi).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(
      /\{\{count\}\}|Invalid input|ZodError/u,
    );

    fetchApi.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await enter('input[name="loginValue"]', "member@example.invalid");
    await enter('input[name="password"]', loginPassword);
    await submit();
    expect(container.textContent).toContain("Profile destination");
    expect(fetchApi).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/iam\/signin$/u),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          login: { kind: "email", value: "member@example.invalid" },
          password: loginPassword,
        }),
      }),
    );
  });

  it("keeps the established identifier rule and masks credential and account-state errors", async () => {
    await render(<SignInPage />);
    await enter('input[name="loginValue"]', "nonempty-but-not-email");
    await enter('input[name="password"]', loginPassword);

    fetchApi.mockResolvedValueOnce(
      failure("authentication.invalid_credentials", 401),
    );
    await submit();
    expect(element('[role="alert"]').textContent).toContain(
      "Unable to sign in",
    );
    await changeLocale("fr");
    const frenchError = element('[role="alert"]').textContent;
    expect(frenchError).toContain("Impossible de vous connecter");
    expect(fetchApi).toHaveBeenCalledTimes(1);

    fetchApi.mockResolvedValueOnce(failure("user.suspended", 403));
    await submit();
    expect(element('[role="alert"]').textContent).toBe(frenchError);
    expect(container.textContent).not.toMatch(
      /suspend|invalid_credentials|internal traceback/u,
    );
  });

  it("masks rejected second factors and keeps the success path", async () => {
    fetchApi.mockResolvedValueOnce(
      Response.json({
        data: {
          mfaRequired: true,
          challengeId: "private-challenge",
          expiresAt: "",
        },
      }),
    );
    await render(<SignInPage />);
    await enter('input[name="loginValue"]', "member@example.invalid");
    await enter('input[name="password"]', loginPassword);
    await submit();
    await enter('input[autocomplete="one-time-code"]', "123456");

    fetchApi.mockResolvedValueOnce(failure("mfa.invalid_code", 401));
    await click("button");
    const englishError = element('[role="alert"]').textContent;
    expect(englishError).toContain("Unable to verify the second factor");
    fetchApi.mockResolvedValueOnce(failure("mfa.not_enabled", 401));
    await click("button");
    expect(element('[role="alert"]').textContent).toBe(englishError);
    await changeLocale("fr");
    expect(element('[role="alert"]').textContent).toContain(
      "Impossible de vérifier le second facteur",
    );
    expect(container.textContent).not.toMatch(
      /private-challenge|mfa\.not_enabled|internal traceback/u,
    );
    expect(fetchApi).toHaveBeenCalledTimes(3);

    fetchApi.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await click("button");
    expect(container.textContent).toContain("Profile destination");
  });
});

describe("registration feedback", () => {
  it("associates localized email and password errors with their fields", async () => {
    await render(<SignUpPage />);
    await enter('input[name="password"]', "short");
    await submit();
    expect(fieldFeedback("loginValue")).toBe("Enter your sign-in identifier.");
    expect(fieldFeedback("password")).toBe(
      "Password must be at least 16 characters long",
    );
    expect(fieldFeedback("passwordConfirmation")).toBe(
      "Password confirmation does not match",
    );

    await enter('input[name="loginValue"]', "not-an-email");
    await enter('input[name="password"]', "x".repeat(49));
    await submit();
    expect(fieldFeedback("loginValue")).toBe("Invalid email");
    expect(fieldFeedback("password")).toBe(
      "Password must be at most 48 characters long",
    );
    await changeLocale("fr");
    expect(fieldFeedback("loginValue")).toBe("Email invalide");
    expect(fieldFeedback("password")).toBe(
      "Le mot de passe doit contenir au maximum 48 caractères",
    );
    expect(fieldFeedback("passwordConfirmation")).toBe(
      "La confirmation ne correspond pas au mot de passe",
    );
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it("separately localizes username validation and a username conflict", async () => {
    client.setQueryData(["public-capabilities"], {
      publicRegistration: true,
      allowedLoginIdentifiers: ["username"],
    });
    await render(<SignUpPage />);
    await fillRegistration("ab");
    await submit();
    expect(fieldFeedback("loginValue")).toContain("Use 3 to 32 characters");
    await changeLocale("fr");
    expect(fieldFeedback("loginValue")).toContain("Le pseudonyme");
    expect(fetchApi).not.toHaveBeenCalled();

    await enter('input[name="loginValue"]', "member-name");
    fetchApi.mockResolvedValueOnce(failure("user.already_exists", 409));
    await submit();
    expect(element('[role="alert"]').textContent).toBe(
      "Cet identifiant de connexion est déjà utilisé.",
    );
    await changeLocale("en");
    expect(element('[role="alert"]').textContent).toBe(
      "This sign-in identifier is already in use.",
    );
    expect(fetchApi).toHaveBeenCalledOnce();
  });

  it("uses actionable server-authoritative password feedback and still registers on success", async () => {
    await render(<SignUpPage />);
    await fillRegistration();
    fetchApi.mockResolvedValueOnce(failure("password.too_weak"));
    await submit();
    expect(element('[role="alert"]').textContent).toContain(
      "unique passphrase",
    );
    await changeLocale("fr");
    expect(element('[role="alert"]').textContent).toContain(
      "phrase de passe plus longue et unique",
    );
    expect(fetchApi).toHaveBeenCalledOnce();

    fetchApi.mockResolvedValueOnce(failure("password.too_common"));
    await submit();
    expect(element('[role="alert"]').textContent).toBe(
      "Ce mot de passe est trop courant.",
    );

    vi.useFakeTimers();
    fetchApi.mockResolvedValueOnce(
      Response.json({ data: { userId: "user-123" } }, { status: 201 }),
    );
    await submit();
    expect(container.textContent).toContain("Inscription réussie");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(fetchApi).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/iam\/signup$/u),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          login: { kind: "email", value: "member@example.invalid" },
          password: newPassword,
          passwordConfirmation: newPassword,
        }),
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(2500));
    expect(container.textContent).toContain("Sign-in destination");
  });

  it.each([
    ["unknown API code", () => failure("password.future_private_code")],
    [
      "malformed code",
      () =>
        Response.json(
          { error: { code: ["password.too_weak"], message: privateDetail } },
          { status: 400 },
        ),
    ],
    ["non-JSON reply", () => new Response(privateDetail, { status: 502 })],
    [
      "network failure",
      () => {
        throw new TypeError(privateDetail);
      },
    ],
    [
      "unexpected exception",
      () => {
        throw new Error("password.too_weak");
      },
    ],
  ] as const)("falls back safely for %s", async (_label, respond) => {
    fetchApi.mockImplementationOnce(async () => respond());
    await render(<SignUpPage />);
    await fillRegistration();
    await submit();
    expect(element('[role="alert"]').textContent).toContain(
      "Please try again later.",
    );
    await changeLocale("fr");
    expect(element('[role="alert"]').textContent).toContain(
      "Réessaie plus tard.",
    );
    expect(container.textContent).not.toMatch(
      /password\.|internal traceback|HTTP_502/u,
    );
    expect(fetchApi).toHaveBeenCalledOnce();
  });
});

it("keeps recovery request success indistinguishable and masks account-sensitive errors", async () => {
  await render(<RecoveryPage />);
  await enter('input[type="email"]', "member@example.invalid");
  fetchApi.mockResolvedValueOnce(failure("user.not_found", 404));
  await click("button");
  expect(element('[role="alert"]').textContent).toContain(
    "temporarily unavailable",
  );
  await changeLocale("fr");
  expect(element('[role="alert"]').textContent).toContain(
    "momentanément indisponible",
  );
  expect(fetchApi).toHaveBeenCalledOnce();

  fetchApi.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await click("button");
  const knownAccount = container.textContent;
  expect(knownAccount).toContain(
    "Si le compte est éligible, les instructions ont été envoyées.",
  );

  await render(<RecoveryPage key="another-request" />);
  await enter('input[type="email"]', "missing@example.invalid");
  fetchApi.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await click("button");
  expect(container.textContent).toBe(knownAccount);
});

it("retranslates email verification failure with one request for the token", async () => {
  fetchApi.mockResolvedValueOnce(failure("email_verification.expired_token"));
  await render(<VerifyEmailPage />, "/verify?token=private-token");
  expect(element('[role="alert"]').textContent).toBe(
    "The verification link is invalid.",
  );
  await changeLocale("fr");
  expect(element('[role="alert"]').textContent).toBe(
    "Le lien de vérification est invalide.",
  );
  expect(container.textContent).not.toMatch(
    /private-token|expired_token|internal traceback/u,
  );
  expect(fetchApi).toHaveBeenCalledExactlyOnceWith(
    expect.stringMatching(/\/iam\/verify\?token=private-token$/u),
    expect.objectContaining({ method: "GET" }),
  );
});

it("masks the reason for a failed account-deletion cancellation in both locales", async () => {
  await render(<CancelDeletionPage />, "/cancel-deletion?token=private-token");
  await enter('input[type="password"]', loginPassword);
  fetchApi.mockResolvedValueOnce(failure("mfa.code_required"));
  await click("button");
  expect(element('[role="alert"]').textContent).toBe(
    "This link is no longer usable or verification failed.",
  );
  await changeLocale("fr");
  expect(element('[role="alert"]').textContent).toBe(
    "Ce lien n’est plus utilisable ou la vérification a échoué.",
  );
  expect(fetchApi).toHaveBeenCalledOnce();
});

it("localizes native email constraints and profile API feedback without retrying", async () => {
  for (const key of [
    "currentUserSessions",
    "account-exports",
    "security-events",
  ]) {
    client.setQueryData([key], []);
  }
  client.setQueryData(["mfa"], { enabled: false, backupCodesRemaining: 0 });
  await render(<ProfilePage user={user} />);

  const email = element<HTMLInputElement>('input[type="email"]');
  await enter('input[type="email"]', "");
  await click('form button[type="submit"]');
  const validationAlert = element('[role="alert"]');
  expect(validationAlert.textContent).toBe("Enter your new email address.");
  expect(email.getAttribute("aria-invalid")).toBe("true");
  expect(email.getAttribute("aria-describedby")).toBe(validationAlert.id);
  expect(document.activeElement).toBe(email);
  await changeLocale("fr");
  expect(validationAlert.textContent).toBe(
    "Saisissez votre nouvelle adresse e-mail.",
  );

  await enter('input[type="email"]', "invalid-email");
  expect(email.hasAttribute("aria-describedby")).toBe(false);
  await click('form button[type="submit"]');
  expect(element('[role="alert"]').textContent).toBe("Email invalide");
  await changeLocale("en");
  expect(element('[role="alert"]').textContent).toBe("Invalid email");
  expect(fetchApi).not.toHaveBeenCalled();

  await enter('input[type="email"]', "replacement@example.invalid");
  fetchApi.mockResolvedValueOnce(failure("email_change.disabled", 403));
  await click('form button[type="submit"]');
  await expectFeedback(
    '[role="status"]',
    "Changing your email address is currently disabled.",
  );
  await changeLocale("fr");
  expect(element('[role="status"]').textContent).toContain(
    "La modification de l’adresse e-mail est actuellement désactivée.",
  );
  expect(container.textContent).not.toMatch(
    /email_change\.disabled|internal traceback/u,
  );
  expect(fetchApi).toHaveBeenCalledOnce();
});

it("retranslates an authorized user-administration error in its existing notice", async () => {
  client.setQueryData(["admin", "users", { page: 1, pageSize: 25 }], {
    users: [user],
    pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  });
  client.setQueryData(["admin", "users-overview"], null);
  client.setQueryData(["admin", "sessions", user.userId], []);
  client.setQueryData(["admin-security-config"], null);
  client.setQueryData(["admin-security-events"], []);
  await render(<AdminPage currentUserId="admin-id" />);
  const row = Array.from(container.querySelectorAll("button")).find((node) =>
    node.textContent?.includes("member@example.invalid"),
  );
  expect(row).toBeDefined();
  await act(() => row?.click());

  fetchApi.mockResolvedValueOnce(
    failure("administrator.last_active_access", 409),
  );
  await clickButton("Suspend");
  await expectFeedback(
    '[role="alert"]',
    "This action must leave at least one usable administrator access path.",
  );
  await changeLocale("fr");
  expect(element('[role="alert"]').textContent).toContain(
    "Cette action doit laisser au moins un accès administrateur utilisable.",
  );
  expect(container.textContent).not.toMatch(
    /administrator\.last_active_access|internal traceback/u,
  );
  expect(fetchApi).toHaveBeenCalledOnce();
});

it("renders a configuration restore conflict without the raw API error", async () => {
  client.setQueryData(["admin-security-config"], {
    effectiveRevision: { version: 2 },
    effective: {},
    catalog: [],
    revisions: [
      {
        id: "previous",
        version: 1,
        status: "superseded",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
  });
  client.setQueryData(["admin-security-events"], []);
  await render(<AdminSecurityCenter />);
  await clickButton("Historique");
  fetchApi.mockResolvedValueOnce(
    failure("security_configuration.version_conflict", 409),
  );
  await clickButton("Restaurer");
  await expectFeedback(
    '[role="alert"]',
    "The configuration has changed. Refresh it before trying again.",
  );
  await changeLocale("fr");
  expect(element('[role="alert"]').textContent).toBe(
    "La configuration a changé. Actualisez-la avant de réessayer.",
  );
  expect(container.textContent).not.toMatch(
    /security_configuration\.version_conflict|internal traceback/u,
  );
  expect(fetchApi).toHaveBeenCalledOnce();
});

it("shows a failed configuration preview after an earlier publication failure", async () => {
  client.setQueryData(["admin-security-config"], {
    effectiveRevision: { version: 2 },
    effective: { accounts: { publicRegistration: true } },
    catalog: [
      {
        key: "accounts.publicRegistration",
        category: "accounts",
        control: "switch",
        impact: "medium",
        availability: { available: true, readOnly: false },
      },
    ],
    revisions: [],
  });
  client.setQueryData(["admin-security-events"], []);
  await render(<AdminSecurityCenter />);
  await click('[role="switch"]');
  await enter("textarea", "Validate the change");
  fetchApi.mockResolvedValueOnce(
    Response.json({
      data: {
        impact: "medium",
        changedKeys: ["accounts.publicRegistration"],
        changes: [],
        warnings: [],
      },
    }),
  );
  await clickButton("Prévisualiser l’impact");
  await expectFeedback("article", "option(s) modifiée(s)");

  fetchApi.mockResolvedValueOnce(
    failure("security_configuration.version_conflict", 409),
  );
  await clickButton("Publier sans redémarrage");
  await expectFeedback('[role="alert"]', "The configuration has changed.");

  fetchApi.mockResolvedValueOnce(
    failure("security_configuration.invalid", 400),
  );
  await clickButton("Prévisualiser l’impact");
  await expectFeedback('[role="alert"]', "Check the configuration settings.");
  await changeLocale("fr");
  expect(element('[role="alert"]').textContent).toBe(
    "Vérifiez les paramètres de la configuration.",
  );
  expect(fetchApi).toHaveBeenCalledTimes(3);
});
