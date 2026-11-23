// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "#app/i18n";
import { ApiRequestError, requestAccountDeletion } from "#services/api";

import { AccountDeletionDialog } from "./AccountDeletionDialog.js";

vi.mock("#services/api", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    readonly code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  requestAccountDeletion: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
let onDismiss = vi.fn<() => void>();
let onPolicyConflict = vi.fn<
  (code: "account_deletion.grace_period_changed" | "account_deletion.disabled") => void
>();

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(requestAccountDeletion).mockReset();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onDismiss = vi.fn<() => void>();
  onPolicyConflict = vi.fn<
    (code: "account_deletion.grace_period_changed" | "account_deletion.disabled") => void
  >();
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

async function mountDialog(mfaEnabled = false, gracePeriodDays = 30) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AccountDeletionDialog
          gracePeriodDays={gracePeriodDays}
          mfaEnabled={mfaEnabled}
          onDismiss={onDismiss}
          onPolicyConflict={onPolicyConflict}
        />
      </QueryClientProvider>,
    );
  });
  const dialog = container.querySelector("dialog");
  if (!dialog) {
    throw new Error("Missing confirmation dialog");
  }
  expect(dialog.open).toBe(true);
  return dialog;
}

async function setInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setter) {
      throw new Error("No native input setter");
    }
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function completeProof(dialog: HTMLDialogElement) {
  const password = dialog.querySelector<HTMLInputElement>("#deletion-password");
  const checkbox = dialog.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (!password || !checkbox) {
    throw new Error("Missing modal-local proof");
  }
  await setInput(password, "deletion-proof");
  await act(async () => {
    checkbox.click();
  });
}

async function submit(dialog: HTMLDialogElement) {
  const form = dialog.querySelector("form");
  if (!form) {
    throw new Error("Missing deletion form");
  }
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

describe("compact account-deletion confirmation dialog", () => {
  it("shows a short reminder, not the full long-form disclosure", async () => {
    const dialog = await mountDialog(true, 16);
    expect(dialog.textContent).toContain("16 jours");
    expect(dialog.textContent).toContain("désactivé immédiatement");
    expect(dialog.querySelector("form section")).toBeNull();
    expect(dialog.textContent).not.toContain("journaux d’audit");
    expect(dialog.textContent).not.toContain("notification");
    expect(dialog.querySelector("#deletion-password")).not.toBeNull();
    expect(dialog.querySelector("#deletion-mfa-code")).not.toBeNull();
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled,
    ).toBe(true);
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it.each([1, 30, 90])(
    "requires explicit acknowledgement for actual duration %s",
    async (days) => {
      const dialog = await mountDialog(false, days);
      const password = dialog.querySelector<HTMLInputElement>(
        "#deletion-password",
      );
      const submitButton = dialog.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      if (!password || !submitButton) {
        throw new Error("Missing proof fields");
      }
      await setInput(password, "deletion-proof");
      expect(submitButton.disabled).toBe(true);
      const checkbox = dialog.querySelector<HTMLInputElement>(
        'input[type="checkbox"]',
      );
      await act(async () => {
        checkbox?.click();
      });
      expect(submitButton.disabled).toBe(false);
      await submit(dialog);
      expect(requestAccountDeletion).toHaveBeenCalledExactlyOnceWith(
        "deletion-proof",
        days,
        undefined,
      );
    },
  );

  it("requires the dialog-local MFA code and trims it at submission", async () => {
    const dialog = await mountDialog(true);
    await completeProof(dialog);
    const mfa = dialog.querySelector<HTMLInputElement>("#deletion-mfa-code");
    const submitButton = dialog.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (!mfa || !submitButton) {
      throw new Error("Missing MFA fields");
    }
    expect(submitButton.disabled).toBe(true);
    await setInput(mfa, " 123456 ");
    expect(submitButton.disabled).toBe(false);
    await submit(dialog);
    expect(requestAccountDeletion).toHaveBeenCalledExactlyOnceWith(
      "deletion-proof",
      30,
      "123456",
    );
  });

  it("prevents duplicate destructive requests and cancellation while pending", async () => {
    vi.mocked(requestAccountDeletion).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof requestAccountDeletion>>>(
          () => undefined,
        ),
    );
    const dialog = await mountDialog();
    await completeProof(dialog);
    const form = dialog.querySelector("form");
    if (!form) {
      throw new Error("Missing form");
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
    const cancel = dialog.querySelector<HTMLButtonElement>(
      'button[type="button"]',
    );
    expect(cancel?.disabled).toBe(true);
    const cancelEvent = new Event("cancel", { cancelable: true });
    await act(async () => {
      dialog.dispatchEvent(cancelEvent);
    });
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
  });

  it.each([
    "account_deletion.grace_period_changed",
    "account_deletion.disabled",
  ] as const)("reports a changed/disabled policy without retrying (%s)", async (code) => {
    vi.mocked(requestAccountDeletion).mockRejectedValue(
      new ApiRequestError(code),
    );
    const dialog = await mountDialog();
    await completeProof(dialog);
    await submit(dialog);
    await vi.waitFor(() => {
      expect(onPolicyConflict).toHaveBeenCalledExactlyOnceWith(code);
    });
    expect(
      dialog.querySelector<HTMLInputElement>("#deletion-password")?.value,
    ).toBe("");
    expect(
      dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')
        ?.checked,
    ).toBe(false);
    expect(requestAccountDeletion).toHaveBeenCalledOnce();
  });

  it.each([
    ["fr", "Désignez un autre administrateur actif"],
    ["en", "Make another administrator active"],
  ] as const)(
    "announces a last-administrator business refusal in %s",
    async (language, message) => {
      await i18n.changeLanguage(language);
      vi.mocked(requestAccountDeletion).mockRejectedValue(
        new ApiRequestError("administrator.last_active_access"),
      );
      const dialog = await mountDialog();
      await completeProof(dialog);
      await submit(dialog);
      await vi.waitFor(() => {
        expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
          message,
        );
      });
      expect(onPolicyConflict).not.toHaveBeenCalled();
    },
  );

  it("announces technical errors and allows explicit retry", async () => {
    vi.mocked(requestAccountDeletion)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockRejectedValueOnce(new Error("network still unavailable"));
    const dialog = await mountDialog();
    await completeProof(dialog);
    await submit(dialog);
    await vi.waitFor(() => {
      expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
        "La demande de suppression n’a pas été acceptée",
      );
    });
    expect(
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled,
    ).toBe(false);
    await submit(dialog);
    expect(requestAccountDeletion).toHaveBeenCalledTimes(2);
  });

  it("restores native dialog cancellation when idle", async () => {
    const dialog = await mountDialog();
    const title = dialog.querySelector("#account-deletion-title");
    const description = dialog.querySelector("#account-deletion-description");
    expect(document.activeElement).toBe(title);
    expect(dialog.getAttribute("aria-labelledby")).toBe(title?.id);
    expect(dialog.getAttribute("aria-describedby")).toBe(description?.id);
    const cancelEvent = new Event("cancel", { cancelable: true });
    await act(async () => {
      dialog.dispatchEvent(cancelEvent);
    });
    expect(cancelEvent.defaultPrevented).toBe(false);
    await act(async () => {
      dialog.close();
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("translates the short confirmation while open", async () => {
    const dialog = await mountDialog();
    expect(dialog.textContent).toContain("Confirmer la suppression");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("Confirm account deletion");
    expect(dialog.textContent).toContain("30-day grace period");
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });
});
