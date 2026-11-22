// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAccountDeletionDisclosure,
  requestAccountDeletion,
} from "#services/api";

import i18n from "../i18n.js";
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

async function openDialog(mfaEnabled = false) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AccountDeletionDialog mfaEnabled={mfaEnabled} mfaLoaded={true} />
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
  await act(async () => {
    await vi.waitFor(() => {
      expect(["success", "error"]).toContain(
        queryClient.getQueryState(["account-deletion-disclosure"])?.status,
      );
    });
  });
  const dialog = container.querySelector("dialog");
  if (!dialog) {
    throw new Error("Missing confirmation dialog");
  }
  return dialog;
}

describe("account deletion confirmation dialog", () => {
  it("displays the actual duration and all approved disclosure categories in French", async () => {
    const dialog = await openDialog(true);
    expect(getAccountDeletionDisclosure).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("30 jours");
    expect(dialog.textContent).toContain("sessions");
    expect(dialog.textContent).toContain("obligation légale");
    expect(dialog.textContent).toContain("administrateur");
    expect(dialog.textContent).toContain("notification");
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

  it("shows the English effective duration without a fixed default", async () => {
    await i18n.changeLanguage("en");
    vi.mocked(getAccountDeletionDisclosure).mockResolvedValue({
      enabled: true,
      gracePeriodDays: 1,
    });
    const dialog = await openDialog();
    expect(dialog.textContent).toContain("1-day grace period");
    expect(dialog.textContent).toContain("last active administrator");
    expect(dialog.textContent).toContain("legal obligations");
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });
});
