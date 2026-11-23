// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "#app/i18n";
import {
  ApiRequestError,
  getAccountDeletionDisclosure,
  requestAccountDeletion,
} from "#services/api";

import { AccountDeletionDialog } from "./AccountDeletionDialog.js";

vi.mock("#services/api", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    readonly code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  getAccountDeletionDisclosure: vi.fn(),
  requestAccountDeletion: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getAccountDeletionDisclosure).mockReset();
  vi.mocked(requestAccountDeletion).mockReset();
  vi.mocked(getAccountDeletionDisclosure).mockResolvedValue({
    enabled: true,
    gracePeriodDays: 30,
  });
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

async function openDialog(mfaEnabled = false, mfaLoaded = true) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AccountDeletionDialog mfaEnabled={mfaEnabled} mfaLoaded={mfaLoaded} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    const open = container.querySelector("button");
    if (!open) {
      throw new Error("Missing deletion trigger");
    }
    open.click();
  });
  const dialog = container.querySelector("dialog");
  if (!dialog) {
    throw new Error("Missing confirmation dialog");
  }
  await vi.waitFor(() => {
    expect(getAccountDeletionDisclosure).toHaveBeenCalledOnce();
    expect(
      dialog.querySelector("form") !== null ||
        dialog.querySelector('[role="alert"]') !== null ||
        dialog.textContent?.includes("désactivée") === true,
    ).toBe(true);
  });
  return dialog;
}

async function completeProof(dialog: HTMLDialogElement) {
  const password = dialog.querySelector<HTMLInputElement>("#deletion-password");
  const acknowledgement = dialog.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (!password || !acknowledgement) {
    throw new Error("Disclosure or password fields unavailable");
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
    acknowledgement.click();
  });
}

describe("account deletion confirmation dialog", () => {
  it("displays the actual duration and all approved disclosure categories in French", async () => {
    const dialog = await openDialog(true);
    expect(getAccountDeletionDisclosure).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("30 jours");
    expect(dialog.textContent).toContain("lien envoyé à votre adresse vérifiée");
    expect(dialog.textContent).toContain("vérification renforcée");
    const sections = dialog.querySelectorAll("form section");
    expect(sections).toHaveLength(3);
    const headings = Array.from(
      sections,
      (section) => section.querySelector("h3")?.textContent,
    );
    expect(headings).toEqual([
      "Dès la confirmation",
      "À l’expiration du délai",
      "Conservation et autres conséquences",
    ]);
    expect(sections[0]?.textContent).toContain("sessions");
    expect(sections[1]?.textContent).toContain("MFA");
    expect(sections[2]?.textContent).toContain("obligation légale");
    expect(sections[2]?.textContent).toContain("administrateur");
    expect(sections[2]?.textContent).toContain("notification");
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.textContent,
    ).toContain("Demander la suppression");
    expect(dialog.querySelector("#deletion-password")).not.toBeNull();
    expect(dialog.querySelector("#deletion-mfa-code")).not.toBeNull();
    expect(
      (dialog.querySelector('button[type="submit"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("blocks confirmation when effective deletion policy is disabled", async () => {
    vi.mocked(getAccountDeletionDisclosure).mockResolvedValue({
      enabled: false,
      gracePeriodDays: 90,
    });
    const dialog = await openDialog();
    expect(dialog.textContent).toContain("désactivée");
    expect(dialog.querySelector("output")?.textContent).toContain("désactivée");
    expect(dialog.textContent).not.toContain(
      "lien envoyé à votre adresse vérifiée",
    );
    expect(dialog.querySelector('button[type="submit"]')).toBeNull();
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("does not submit when the effective policy read fails", async () => {
    vi.mocked(getAccountDeletionDisclosure).mockRejectedValue(
      new Error("configuration unavailable"),
    );
    const dialog = await openDialog();
    expect(dialog.textContent).toContain("Impossible de connaître le délai");
    expect(dialog.querySelector('button[type="submit"]')).toBeNull();
    expect(dialog.textContent).not.toContain("14 jours");
  });

  it("requires new consent after a changed-period conflict", async () => {
    vi.mocked(getAccountDeletionDisclosure)
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 30 })
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 14 });
    vi.mocked(requestAccountDeletion).mockRejectedValue(
      new ApiRequestError("account_deletion.grace_period_changed"),
    );
    const dialog = await openDialog();
    await completeProof(dialog);
    const submit = dialog.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    const form = dialog.querySelector("form");
    if (!submit || !form) {
      throw new Error("Missing deletion form");
    }
    expect(submit.disabled).toBe(false);
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await vi.waitFor(() => {
      expect(getAccountDeletionDisclosure).toHaveBeenCalledTimes(2);
      expect(dialog.textContent).toContain("14 jours");
    });
    expect(requestAccountDeletion).toHaveBeenCalledExactlyOnceWith(
      "deletion-proof",
      30,
      undefined,
    );
    expect(dialog.textContent).toContain("Le délai de grâce a changé");
    expect(submit.disabled).toBe(true);
  });

  it("does not submit the same destructive command twice", async () => {
    vi.mocked(requestAccountDeletion).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof requestAccountDeletion>>>(
          () => undefined,
        ),
    );
    const dialog = await openDialog();
    await completeProof(dialog);
    const form = dialog.querySelector("form");
    if (!form) {
      throw new Error("Missing deletion form");
    }
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(requestAccountDeletion).toHaveBeenCalledOnce();
    expect(requestAccountDeletion).toHaveBeenCalledWith(
      "deletion-proof",
      30,
      undefined,
    );
  });

  it("retries a failed effective-policy read before allowing any confirmation", async () => {
    vi.mocked(getAccountDeletionDisclosure)
      .mockRejectedValueOnce(new Error("configuration unavailable"))
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 90 });

    const dialog = await openDialog();
    expect(dialog.textContent).toContain("Impossible de connaître le délai");
    expect(dialog.querySelector('button[type="submit"]')).toBeNull();

    const retry = dialog.querySelector<HTMLButtonElement>("button");
    if (!retry) {
      throw new Error("Missing effective-policy retry button");
    }
    await act(async () => {
      retry.click();
    });
    await vi.waitFor(() => {
      expect(getAccountDeletionDisclosure).toHaveBeenCalledTimes(2);
      expect(dialog.textContent).toContain("90 jours");
    });
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("blocks a second confirmation when deletion becomes disabled after disclosure", async () => {
    vi.mocked(getAccountDeletionDisclosure)
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 30 })
      .mockResolvedValueOnce({ enabled: false, gracePeriodDays: 30 });
    vi.mocked(requestAccountDeletion).mockRejectedValue(
      new ApiRequestError("account_deletion.disabled"),
    );

    const dialog = await openDialog();
    await completeProof(dialog);
    const form = dialog.querySelector("form");
    if (!form) {
      throw new Error("Missing deletion form");
    }
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    await vi.waitFor(() => {
      expect(getAccountDeletionDisclosure).toHaveBeenCalledTimes(2);
      expect(dialog.textContent).toContain("désactivée");
    });
    expect(requestAccountDeletion).toHaveBeenCalledExactlyOnceWith(
      "deletion-proof",
      30,
      undefined,
    );
    expect(dialog.querySelector("form")).toBeNull();
    expect(dialog.textContent).toContain("suppression des comptes");
  });

  it.each([
    [
      "fr",
      "Désignez un autre administrateur actif avant de renouveler la demande",
    ],
    [
      "en",
      "Make another administrator active before requesting deletion again",
    ],
  ] as const)(
    "explains the corrective action when the last active administrator requests deletion in %s",
    async (language, expectedMessage) => {
      await i18n.changeLanguage(language);
      vi.mocked(requestAccountDeletion).mockRejectedValue(
        new ApiRequestError("administrator.last_active_access"),
      );
      const dialog = await openDialog();
      await completeProof(dialog);
      const form = dialog.querySelector("form");
      if (!form) {
        throw new Error("Missing deletion form");
      }
      await act(async () => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });
      await vi.waitFor(() => {
        expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
          expectedMessage,
        );
      });
      expect(requestAccountDeletion).toHaveBeenCalledExactlyOnceWith(
        "deletion-proof",
        30,
        undefined,
      );
      expect(getAccountDeletionDisclosure).toHaveBeenCalledOnce();
    },
  );

  it("surfaces a technical submission failure without losing the disclosed consent", async () => {
    vi.mocked(requestAccountDeletion).mockRejectedValue(
      new Error("network unreachable"),
    );
    const dialog = await openDialog();
    await completeProof(dialog);
    const form = dialog.querySelector("form");
    if (!form) {
      throw new Error("Missing deletion form");
    }
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await vi.waitFor(() => {
      expect(dialog.textContent).toContain(
        "La demande de suppression n’a pas été acceptée",
      );
    });
    expect(requestAccountDeletion).toHaveBeenCalledOnce();
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(false);
  });

  it("resets the credentials and requires fresh policy consent when reopened", async () => {
    vi.mocked(getAccountDeletionDisclosure)
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 30 })
      .mockResolvedValueOnce({ enabled: true, gracePeriodDays: 14 });

    const dialog = await openDialog();
    await completeProof(dialog);
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(false);

    const cancel = dialog.querySelector<HTMLButtonElement>(
      'form button[type="button"]',
    );
    if (!cancel) {
      throw new Error("Missing cancellation button");
    }
    await act(async () => {
      cancel.click();
    });
    expect(dialog.open).toBe(false);
    const trigger = container.querySelector<HTMLButtonElement>("button");
    expect(document.activeElement).toBe(trigger);
    if (!trigger) {
      throw new Error("Missing deletion trigger");
    }
    await act(async () => {
      trigger.click();
    });
    await vi.waitFor(() => {
      expect(getAccountDeletionDisclosure).toHaveBeenCalledTimes(2);
      expect(dialog.textContent).toContain("14 jours");
    });
    expect(dialog.open).toBe(true);
    expect(
      dialog.querySelector<HTMLInputElement>("#deletion-password")?.value,
    ).toBe("");
    expect(
      dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked,
    ).toBe(false);
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("requires a loaded MFA state before enabling deletion confirmation", async () => {
    const dialog = await openDialog(false, false);
    await completeProof(dialog);
    expect(dialog.textContent).toContain(
      "Chargement de la politique de suppression",
    );
    expect(dialog.querySelector("output")?.textContent).toContain(
      "Chargement de la politique de suppression",
    );
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("submits the dialog-local MFA code and prevents cancellation while pending", async () => {
    vi.mocked(requestAccountDeletion).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof requestAccountDeletion>>>(
          () => undefined,
        ),
    );
    const dialog = await openDialog(true);
    await completeProof(dialog);
    const mfa = dialog.querySelector<HTMLInputElement>("#deletion-mfa-code");
    const form = dialog.querySelector("form");
    if (!mfa || !form) {
      throw new Error("Missing modal-local MFA proof fields");
    }
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!setter) {
        throw new Error("No native input setter");
      }
      setter.call(mfa, " 123456 ");
      mfa.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(false);

    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(requestAccountDeletion).toHaveBeenCalledExactlyOnceWith(
      "deletion-proof",
      30,
      "123456",
    );
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);

    const cancelEvent = new Event("cancel", { cancelable: true });
    await act(async () => {
      dialog.dispatchEvent(cancelEvent);
    });
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
  });

  it("focuses the named dialog heading and announces technical errors", async () => {
    const dialog = await openDialog();
    const heading = dialog.querySelector<HTMLHeadingElement>(
      "#account-deletion-title",
    );
    const description = dialog.querySelector("#account-deletion-description");
    expect(heading).not.toBeNull();
    expect(description).not.toBeNull();
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading?.id);
    expect(dialog.getAttribute("aria-describedby")).toBe(description?.id);
    expect(document.activeElement).toBe(heading);

    await completeProof(dialog);
    vi.mocked(requestAccountDeletion).mockRejectedValue(
      new Error("network unavailable"),
    );
    const form = dialog.querySelector("form");
    if (!form) {
      throw new Error("Missing deletion form");
    }
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await vi.waitFor(() => {
      expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
        "La demande de suppression n’a pas été acceptée",
      );
    });
  });

  it("allows Escape-style native cancellation when no deletion is pending", async () => {
    const dialog = await openDialog();
    const trigger = container.querySelector<HTMLButtonElement>("button");
    const cancelEvent = new Event("cancel", { cancelable: true });
    await act(async () => {
      dialog.dispatchEvent(cancelEvent);
    });
    expect(cancelEvent.defaultPrevented).toBe(false);

    // The browser closes a native dialog after an uncancelled Escape event.
    // JSDOM does not implement that default action, so emulate only the close.
    await act(async () => {
      dialog.close();
    });
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("switches disclosure language while open without submitting deletion", async () => {
    const dialog = await openDialog();
    expect(dialog.textContent).toContain("30 jours");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("30-day grace period");
    expect(dialog.textContent).toContain("last active administrator");
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("shows the English effective duration without a fixed default", async () => {
    await i18n.changeLanguage("en");
    vi.mocked(getAccountDeletionDisclosure).mockResolvedValue({
      enabled: true,
      gracePeriodDays: 1,
    });
    const dialog = await openDialog();
    expect(dialog.textContent).toContain("1-day grace period");
    expect(dialog.textContent).toContain("verified email address");
    expect(dialog.textContent).toContain("strengthened identity verification");
    const headings = Array.from(
      dialog.querySelectorAll("form section h3"),
      (heading) => heading.textContent,
    );
    expect(headings).toEqual([
      "Immediately after confirmation",
      "After the grace period",
      "Retention and other consequences",
    ]);
    expect(dialog.textContent).toContain("last active administrator");
    expect(dialog.textContent).toContain("legal obligations");
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });
});
