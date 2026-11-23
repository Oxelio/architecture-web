import { useMutation } from "@tanstack/react-query";
import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiRequestError, requestAccountDeletion } from "#services/api";

type PolicyConflictCode =
  | "account_deletion.grace_period_changed"
  | "account_deletion.disabled";

interface AccountDeletionDialogProps {
  readonly gracePeriodDays: number;
  readonly mfaEnabled: boolean;
  readonly onDismiss: () => void;
  readonly onPolicyConflict: (code: PolicyConflictCode) => void;
}

/**
 * Final proof and consent only. The complete, approved disclosures are shown
 * on AccountDeletionPage before this dialog can be reached.
 */
export function AccountDeletionDialog({
  gracePeriodDays,
  mfaEnabled,
  onDismiss,
  onPolicyConflict,
}: Readonly<AccountDeletionDialogProps>) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const submissionInFlight = useRef(false);
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const deletion = useMutation({
    mutationFn: () =>
      requestAccountDeletion(
        password,
        gracePeriodDays,
        mfaEnabled ? mfaCode.trim() : undefined,
      ),
    onSuccess: () => window.location.assign("/"),
    onError: (error: unknown) => {
      const code = error instanceof ApiRequestError ? error.code : "";
      if (
        code === "account_deletion.grace_period_changed" ||
        code === "account_deletion.disabled"
      ) {
        setPassword("");
        setMfaCode("");
        setAcknowledged(false);
        onPolicyConflict(code);
      } else if (code === "administrator.last_active_access") {
        setErrorKey("securityCenter.deletionLastAdministrator");
      } else {
        setErrorKey("securityCenter.deletionError");
      }
    },
    onSettled: () => {
      submissionInFlight.current = false;
    },
  });

  useEffect(() => {
    // React StrictMode replays effects in development. Do not treat its
    // cleanup as a user dismissal of the native modal.
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      heading.current?.focus();
    }
  }, []);

  const canConfirm =
    password.length > 0 &&
    acknowledged &&
    (!mfaEnabled || mfaCode.trim().length > 0) &&
    !deletion.isPending;

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canConfirm || submissionInFlight.current) {
      return;
    }
    submissionInFlight.current = true;
    setErrorKey(null);
    deletion.mutate();
  }

  function close() {
    if (!submissionInFlight.current && !deletion.isPending) {
      dialog.current?.close();
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="account-deletion-title"
      aria-describedby="account-deletion-description"
      onClose={onDismiss}
      onCancel={(event) => {
        if (deletion.isPending || submissionInFlight.current) {
          event.preventDefault();
        }
      }}
      className="max-h-[90dvh] w-[min(92vw,28rem)] overflow-y-auto rounded-2xl border border-rose-500/30 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80 sm:p-6"
    >
      <h2
        id="account-deletion-title"
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold"
      >
        {t("securityCenter.deletionConfirmTitle")}
      </h2>
      <p
        id="account-deletion-description"
        className="mt-2 text-sm leading-6 text-slate-300"
      >
        {t("securityCenter.deletionConfirmDescription")}
      </p>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <p
          className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm font-semibold leading-6 text-amber-100"
        >
          {t("securityCenter.deletionGracePeriod", {
            count: gracePeriodDays,
          })}
        </p>
        <label
          className="flex items-start gap-3 text-sm leading-6 text-slate-200"
        >
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-rose-400"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            {t("securityCenter.deletionAcknowledgement", {
              count: gracePeriodDays,
            })}
          </span>
        </label>
        <div>
          <label htmlFor="deletion-password" className="mb-1 block text-sm">
            {t("securityCenter.currentPassword")}
          </label>
          <input
            id="deletion-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-rose-300"
          />
        </div>
        {mfaEnabled ? (
          <div>
            <label htmlFor="deletion-mfa-code" className="mb-1 block text-sm">
              {t("securityCenter.mfaCode")}
            </label>
            <input
              id="deletion-mfa-code"
              required
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-rose-300"
            />
          </div>
        ) : null}
        {errorKey ? (
          <p role="alert" className="text-sm text-rose-300">
            {t(errorKey)}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={deletion.isPending}
            onClick={close}
            className="min-h-11 rounded-lg border border-slate-600 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:opacity-50"
          >
            {t("securityCenter.deletionCancel")}
          </button>
          <button
            type="submit"
            disabled={!canConfirm}
            className="min-h-11 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:bg-rose-950 disabled:text-rose-200"
          >
            {deletion.isPending
              ? t("securityCenter.deletionPending")
              : t("securityCenter.deletionConfirmAction")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
