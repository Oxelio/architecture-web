import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import {
  ApiRequestError,
  getAccountDeletionDisclosure,
  requestAccountDeletion,
} from "#services/api";

interface AccountDeletionDialogProps {
  readonly mfaEnabled: boolean;
  readonly mfaLoaded: boolean;
}

type DeletionConfirmationFormProps = Readonly<{
  gracePeriodDays: number;
  mfaEnabled: boolean;
  mfaLoaded: boolean;
  password: string;
  setPassword: (value: string) => void;
  mfaCode: string;
  setMfaCode: (value: string) => void;
  acknowledgedDays: number | null;
  setAcknowledgedDays: (value: number | null) => void;
  errorKey: string | null;
  pending: boolean;
  canConfirm: boolean;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  onClose: () => void;
}>;

function DeletionConfirmationForm({
  gracePeriodDays,
  mfaEnabled,
  mfaLoaded,
  password,
  setPassword,
  mfaCode,
  setMfaCode,
  acknowledgedDays,
  setAcknowledgedDays,
  errorKey,
  pending,
  canConfirm,
  onSubmit,
  onClose,
}: DeletionConfirmationFormProps) {
  const { t } = useTranslation();

  return (
    <form className="mt-5 space-y-4" onSubmit={onSubmit}>
      <p className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 font-semibold text-amber-100">
        {t("securityCenter.deletionGracePeriod", {
          count: gracePeriodDays,
        })}
      </p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
        <li>{t("securityCenter.deletionAccess")}</li>
        <li>{t("securityCenter.deletionData")}</li>
        <li>{t("securityCenter.deletionRetention")}</li>
        <li>{t("securityCenter.deletionAdministrator")}</li>
        <li>{t("securityCenter.deletionNotification")}</li>
      </ul>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 accent-rose-400"
          checked={acknowledgedDays === gracePeriodDays}
          onChange={(event) =>
            setAcknowledgedDays(event.target.checked ? gracePeriodDays : null)
          }
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
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2"
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
            className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </div>
      ) : null}
      {!mfaLoaded ? (
        <output className="block text-sm">
          {t("securityCenter.deletionLoading")}
        </output>
      ) : null}
      {errorKey ? (
        <p role="alert" className="text-sm text-rose-300">
          {t(errorKey)}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50"
        >
          {t("securityCenter.deletionCancel")}
        </button>
        <button
          type="submit"
          disabled={!canConfirm}
          className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? t("securityCenter.deletionPending")
            : t("securityCenter.deletionConfirmAction")}
        </button>
      </div>
    </form>
  );
}

type DeletionContentProps = Readonly<{
  loading: boolean;
  failed: boolean;
  disabled: boolean;
  available: boolean;
  errorKey: string | null;
  onRetry: () => void;
  onClose: () => void;
  children: ReactNode;
}>;

function DeletionContent({
  loading,
  failed,
  disabled,
  available,
  errorKey,
  onRetry,
  onClose,
  children,
}: DeletionContentProps) {
  const { t } = useTranslation();
  let body = children;

  if (loading) {
    body = (
      <output className="mt-5 block text-sm">
        {t("securityCenter.deletionLoading")}
      </output>
    );
  } else if (failed) {
    body = (
      <div className="mt-5 space-y-3" role="alert">
        <p>{t("securityCenter.deletionUnavailable")}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-slate-500 px-3 py-2"
        >
          {t("securityCenter.deletionRetry")}
        </button>
      </div>
    );
  } else if (disabled) {
    body = (
      <output className="mt-5 block">
        {t("securityCenter.deletionDisabled")}
      </output>
    );
  }

  return (
    <>
      {body}
      {!available ? (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2"
          >
            {t("securityCenter.deletionCancel")}
          </button>
        </div>
      ) : null}
      {errorKey && !available ? (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {t(errorKey)}
        </p>
      ) : null}
    </>
  );
}

export function AccountDeletionDialog({
  mfaEnabled,
  mfaLoaded,
}: AccountDeletionDialogProps) {
  const { t } = useTranslation();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [disclosureRequestKey, setDisclosureRequestKey] = useState(0);
  const submissionInFlight = useRef(false);
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [acknowledgedDays, setAcknowledgedDays] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const disclosure = useQuery({
    queryKey: ["account-deletion-disclosure", disclosureRequestKey],
    queryFn: getAccountDeletionDisclosure,
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const deletion = useMutation({
    mutationFn: (input: {
      password: string;
      confirmedGracePeriodDays: number;
      mfaCode?: string;
    }) =>
      requestAccountDeletion(
        input.password,
        input.confirmedGracePeriodDays,
        input.mfaCode,
      ),
    onSuccess: () => window.location.assign("/"),
    onError: (error: unknown) => {
      submissionInFlight.current = false;
      const code = error instanceof ApiRequestError ? error.code : "";
      if (code === "account_deletion.grace_period_changed") {
        setErrorKey("securityCenter.deletionChanged");
        setAcknowledgedDays(null);
        setPassword("");
        setMfaCode("");
        void disclosure.refetch();
      } else if (code === "account_deletion.disabled") {
        setErrorKey("securityCenter.deletionDisabled");
        setAcknowledgedDays(null);
        void disclosure.refetch();
      } else if (code === "administrator.last_active_access") {
        setErrorKey("securityCenter.deletionLastAdministrator");
      } else {
        setErrorKey("securityCenter.deletionError");
      }
    },
  });

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      heading.current?.focus();
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  }, [open]);

  function resetAndRestoreFocus() {
    setOpen(false);
    setPassword("");
    setMfaCode("");
    setAcknowledgedDays(null);
    setErrorKey(null);
    trigger.current?.focus();
  }

  function close() {
    if (!submissionInFlight.current && !deletion.isPending) {
      setOpen(false);
    }
  }

  const current =
    disclosure.isSuccess && !disclosure.isFetching && !disclosure.isError
      ? disclosure.data
      : null;
  const available = current?.enabled === true;
  const canConfirm =
    current !== null &&
    current.enabled &&
    mfaLoaded &&
    password.length > 0 &&
    (!mfaEnabled || mfaCode.trim().length > 0) &&
    acknowledgedDays === current.gracePeriodDays &&
    !deletion.isPending;

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canConfirm || !current || submissionInFlight.current) {
      return;
    }
    submissionInFlight.current = true;
    setErrorKey(null);
    deletion.mutate({
      password,
      confirmedGracePeriodDays: current.gracePeriodDays,
      ...(mfaEnabled ? { mfaCode: mfaCode.trim() } : {}),
    });
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setPassword("");
          setMfaCode("");
          setAcknowledgedDays(null);
          setErrorKey(null);
          setDisclosureRequestKey((key) => key + 1);
          setOpen(true);
        }}
        className="mt-5 rounded-xl border border-rose-500/40 px-4 py-2 text-rose-300"
      >
        {t("securityCenter.deleteRequest")}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="account-deletion-title"
        aria-describedby="account-deletion-description"
        onClose={resetAndRestoreFocus}
        onCancel={(event) => {
          if (deletion.isPending || submissionInFlight.current) {
            event.preventDefault();
          }
        }}
        className="max-h-[90vh] w-[min(92vw,36rem)] overflow-y-auto rounded-2xl border border-rose-500/30 bg-slate-900 p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
      >
        <h2
          id="account-deletion-title"
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold"
        >
          {t("securityCenter.deletionTitle")}
        </h2>
        <p
          id="account-deletion-description"
          className="mt-2 text-sm text-slate-300"
        >
          {t("securityCenter.deletionDescription")}
        </p>

        <DeletionContent
          loading={
            disclosure.isFetching ||
            (!disclosure.isSuccess && !disclosure.isError)
          }
          failed={disclosure.isError}
          disabled={current?.enabled === false}
          available={available}
          errorKey={errorKey}
          onRetry={() => void disclosure.refetch()}
          onClose={close}
        >
          {available && current ? (
            <DeletionConfirmationForm
              gracePeriodDays={current.gracePeriodDays}
              mfaEnabled={mfaEnabled}
              mfaLoaded={mfaLoaded}
              password={password}
              setPassword={setPassword}
              mfaCode={mfaCode}
              setMfaCode={setMfaCode}
              acknowledgedDays={acknowledgedDays}
              setAcknowledgedDays={setAcknowledgedDays}
              errorKey={errorKey}
              pending={deletion.isPending}
              canConfirm={canConfirm}
              onSubmit={submit}
              onClose={close}
            />
          ) : null}
        </DeletionContent>
      </dialog>
    </>
  );
}
