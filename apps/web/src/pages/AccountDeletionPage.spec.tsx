// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "#app/i18n";
import {
  ApiRequestError,
  getAccountDeletionDisclosure,
  getMfaStatus,
  requestAccountDeletion,
} from "#services/api";

import { AccountDeletionPage } from "./AccountDeletionPage";

vi.mock("#services/api", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    readonly code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  getAccountDeletionDisclosure: vi.fn(),
  getMfaStatus: vi.fn(),
  requestAccountDeletion: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

const mfaDisabled = {
  enabled: false,
  enabledAt: null,
  backupCodesRemaining: 0,
  lowBackupCodes: false,
};

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getAccountDeletionDisclosure).mockReset();
  vi.mocked(getMfaStatus).mockReset();
  vi.mocked(requestAccountDeletion).mockReset();
  vi.mocked(getAccountDeletionDisclosure).mockResolvedValue({
    enabled: true,
    gracePeriodDays: 30,
  });
  vi.mocked(getMfaStatus).mockResolvedValue(mfaDisabled);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
  await i18n.changeLanguage("fr");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  queryClient.clear();
  container.remove();
  vi.restoreAllMocks();
});

async function renderPage() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/profile/deletion"]}>
          <AccountDeletionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await vi.waitFor(() => {
    expect(getAccountDeletionDisclosure).toHaveBeenCalled();
  });
}

function continueButton() {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) =>
    button.textContent?.includes("Continuer vers la confirmation"),
  );
}

async function continueToDialog() {
  await vi.waitFor(() => {
    expect(continueButton()?.disabled).toBe(false);
  });
  await act(async () => {
    continueButton()?.click();
  });
  await vi.waitFor(() => {
    expect(container.querySelector("dialog")?.open).toBe(true);
  });
  const dialog = container.querySelector("dialog");
  if (!dialog) {
    throw new Error("Missing compact confirmation");
  }
  return dialog;
}

async function completeProof(dialog: HTMLDialogElement) {
  const password = dialog.querySelector<HTMLInputElement>("#deletion-password");
  const checkbox = dialog.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (!password || !checkbox) {
    throw new Error("Missing consent proof");
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setter) {
      throw new Error("No native input setter");
    }
    setter.call(password, "deletion-proof");
    password.dispatchEvent(new Event("input", { bubbles: true }));
    checkbox.click();
  });
}

describe("account-deletion information page", () => {
  it.each([1, 16, 90])(
    "discloses complete FR consequences before confirmation at %s days",
    async (days) => {
      vi.mocked(getAccountDeletionDisclosure).mockResolvedValue({
        enabled: true,
        gracePeriodDays: days,
      });
      await renderPage();
      await vi.waitFor(() => {
        expect(container.textContent).toContain(
          days === 1 ? "1 jour" : String(days) + " jours",
        );
      });
      const headings = Array.from(
        container.querySelectorAll("article section h2"),
        (element) => element.textContent,
      );
      expect(headings).toContain("Dès la confirmation");
      expect(headings).toContain("À l’expiration du délai");
      expect(headings).toContain("Conservation et autres conséquences");
      expect(container.textContent).toContain(
        "lien envoyé à votre adresse vérifiée",
      );
      expect(container.textContent).toContain("jetons de récupération");
      expect(container.textContent).toContain("secrets et codes MFA");
      expect(container.textContent).toContain("journaux d’audit");
      expect(container.textContent).toContain("dernier administrateur actif");
      expect(container.textContent).toContain("notification");
      expect(container.querySelector("dialog")).toBeNull();
      expect(continueButton()).not.toBeUndefined();
      expect(requestAccountDeletion).not.toHaveBeenCalled();
    },
  );

  it("keeps the page in natural flow with a separate back link", async () => {
    await renderPage();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("30 jours");
    });
    expect(container.querySelector("article")).not.toBeNull();
    expect(container.querySelector('a[href="/profile"]')).not.toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("blocks confirmation when deletion is disabled", async () => {
    vi.mocked(getAccountDeletionDisclosure).mockResolvedValue({
      enabled: false,
      gracePeriodDays: 30,
    });
    await renderPage();
    await vi.waitFor(() => {
      expect(container.textContent).toContain(
        "suppression des comptes est actuellement désactivée",
      );
    });
    expect(continueButton()).toBeUndefined();
    expect(container.querySelector("output")?.textContent).toContain(
      "suppression des comptes est actuellement désactivée",
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("fails closed and retries a failed policy read", async () => {
    vi.mocked(getAccountDeletionDisclosure)
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 90 });
    await renderPage();
    await vi.waitFor(() => {
      expect(container.textContent).toContain(
        "Impossible de connaître le délai",
      );
    });
    expect(container.textContent).not.toContain("14 jours");
    expect(continueButton()).toBeUndefined();
    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Réessayer"),
    );
    await act(async () => {
      retry?.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain("90 jours");
    });
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("refreshes policy before opening the compact modal", async () => {
    await renderPage();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("30 jours");
    });
    const dialog = await continueToDialog();
    expect(getAccountDeletionDisclosure).toHaveBeenCalledTimes(2);
    expect(getMfaStatus).toHaveBeenCalledTimes(2);
    expect(dialog.textContent).toContain("30 jours");
    expect(dialog.textContent).not.toContain("journaux d’audit");
    expect(container.textContent).toContain("journaux d’audit");
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("requires another Continue when the policy changes", async () => {
    vi.mocked(getAccountDeletionDisclosure)
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 30 })
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 90 })
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 90 });
    await renderPage();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("30 jours");
    });
    await vi.waitFor(() => {
      expect(continueButton()?.disabled).toBe(false);
    });
    await act(async () => {
      continueButton()?.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain("90 jours");
      expect(container.textContent).toContain("Le délai de grâce a changé");
    });
    expect(container.querySelector("dialog")).toBeNull();
    const dialog = await continueToDialog();
    expect(dialog.textContent).toContain("90 jours");
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("returns to disclosure after a server-side 409", async () => {
    vi.mocked(getAccountDeletionDisclosure)
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 30 })
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 30 })
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 14 });
    vi.mocked(requestAccountDeletion).mockRejectedValue(
      new ApiRequestError("account_deletion.grace_period_changed"),
    );
    await renderPage();
    const dialog = await continueToDialog();
    await completeProof(dialog);
    const form = dialog.querySelector("form");
    if (!form) {
      throw new Error("Missing confirmation form");
    }
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await vi.waitFor(() => {
      expect(container.querySelector("dialog")).toBeNull();
      expect(container.textContent).toContain("14 jours");
      expect(container.textContent).toContain("Le délai de grâce a changé");
    });
    expect(requestAccountDeletion).toHaveBeenCalledExactlyOnceWith(
      "deletion-proof",
      30,
      undefined,
    );
    await vi.waitFor(() => {
      expect(continueButton()?.disabled).toBe(false);
    });
  });

  it("restores focus and refreshes policy on reopening", async () => {
    const dialog = await (async () => {
      await renderPage();
      return continueToDialog();
    })();
    const cancel = dialog.querySelector<HTMLButtonElement>(
      'button[type="button"]',
    );
    if (!cancel) {
      throw new Error("Missing cancel button");
    }
    await act(async () => {
      cancel.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(continueButton());
    await continueToDialog();
    expect(getAccountDeletionDisclosure).toHaveBeenCalledTimes(3);
  });

  it("requires a fresh MFA read before entering confirmation", async () => {
    vi.mocked(getMfaStatus)
      .mockResolvedValueOnce(mfaDisabled)
      .mockRejectedValueOnce(new Error("mfa unavailable"));
    await renderPage();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("30 jours");
    });
    await vi.waitFor(() => {
      expect(continueButton()?.disabled).toBe(false);
    });
    await act(async () => {
      continueButton()?.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain(
        "Impossible de vérifier l’état MFA",
      );
    });
    expect(container.querySelector("dialog")).toBeNull();
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("translates all information in English", async () => {
    await renderPage();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("30 jours");
    });
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(container.textContent).toContain("30-day grace period");
    expect(container.textContent).toContain("Retained audit records");
    expect(container.textContent).toContain("last active administrator");
    expect(container.textContent).toContain("A notification authorized before");
    expect(container.querySelector("dialog")).toBeNull();
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });
});
