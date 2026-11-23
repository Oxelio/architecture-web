import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { AccountDeletionDialog } from "#components/AccountDeletionDialog";
import { getAccountDeletionDisclosure, getMfaStatus } from "#services/api";

type PolicyResult = {
  readonly status: string;
  readonly data: Awaited<ReturnType<typeof getAccountDeletionDisclosure>> | undefined;
};

function policyReadNotice(result: PolicyResult, reviewedDays: number): string | null {
  if (result.status !== "success" || !result.data) {
    return "securityCenter.deletionUnavailable";
  }
  if (!result.data.enabled) {
    return "securityCenter.deletionDisabled";
  }
  if (result.data.gracePeriodDays !== reviewedDays) {
    return "securityCenter.deletionChanged";
  }
  return null;
}

interface PolicyReadStateProps {
  readonly loading: boolean;
  readonly error: boolean;
  readonly disabled: boolean;
  readonly onRetry: () => void;
}

function PolicyReadState({
  loading,
  error,
  disabled,
  onRetry,
}: PolicyReadStateProps) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <output className="block rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-200">
        {t("securityCenter.deletionLoading")}
      </output>
    );
  }
  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-500/40 bg-slate-900 p-5">
        <p>{t("securityCenter.deletionUnavailable")}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-lg border border-slate-500 px-4 py-2"
        >
          {t("securityCenter.deletionRetry")}
        </button>
      </div>
    );
  }
  if (disabled) {
    return (
      <output className="block rounded-2xl border border-slate-700 bg-slate-900 p-5">
        {t("securityCenter.deletionDisabled")}
      </output>
    );
  }
  return null;
}

export function AccountDeletionPage() {
  const { t } = useTranslation();
  const continueButton = useRef<HTMLButtonElement>(null);
  const verifying = useRef(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confirmationDays, setConfirmationDays] = useState<number | null>(null);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);

  const disclosure = useQuery({
    queryKey: ["account-deletion-disclosure"],
    queryFn: getAccountDeletionDisclosure,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const mfa = useQuery({
    queryKey: ["mfa"],
    queryFn: getMfaStatus,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });

  const available = disclosure.isSuccess && disclosure.data.enabled;
  const canContinue =
    available &&
    !disclosure.isFetching &&
    mfa.isSuccess &&
    !mfa.isFetching &&
    !isVerifying;

  async function continueToConfirmation() {
    if (!canContinue || !disclosure.data || verifying.current) {
      return;
    }
    verifying.current = true;
    setIsVerifying(true);
    setNoticeKey(null);
    const reviewedDays = disclosure.data.gracePeriodDays;
    try {
      const policy = await disclosure.refetch();
      const policyNotice = policyReadNotice(policy, reviewedDays);
      if (policyNotice) {
        setNoticeKey(policyNotice);
        return;
      }
      const proof = await mfa.refetch();
      if (proof.status !== "success" || !proof.data) {
        setNoticeKey("securityCenter.deletionMfaUnavailable");
        return;
      }
      setConfirmationDays(reviewedDays);
    } catch {
      setNoticeKey("securityCenter.deletionUnavailable");
    } finally {
      verifying.current = false;
      setIsVerifying(false);
    }
  }

  function handlePolicyConflict(
    code: "account_deletion.grace_period_changed" | "account_deletion.disabled",
  ) {
    setConfirmationDays(null);
    setNoticeKey(
      code === "account_deletion.disabled"
        ? "securityCenter.deletionDisabled"
        : "securityCenter.deletionChanged",
    );
    void disclosure.refetch();
  }

  function dismissConfirmation() {
    setConfirmationDays(null);
    continueButton.current?.focus();
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/profile"
          className="text-sm text-sky-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-sky-300"
        >
          {t("securityCenter.deletionBack")}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          {t("securityCenter.deletionTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {t("securityCenter.deletionDescription")}
        </p>
      </div>

      <PolicyReadState
        loading={disclosure.isPending || (disclosure.isFetching && !disclosure.data)}
        error={disclosure.isError}
        disabled={!available}
        onRetry={() => void disclosure.refetch()}
      />
      {available ? (
        <>
          <section className="rounded-2xl border border-amber-500/40 bg-amber-950/25 p-5">
            <h2 className="font-semibold leading-6 text-amber-100">
              {t("securityCenter.deletionGracePeriod", {
                count: disclosure.data.gracePeriodDays,
              })}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              {t("securityCenter.deletionCancellation")}
            </p>
          </section>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-7">
            <section aria-labelledby="deletion-immediate">
              <h2 id="deletion-immediate" className="font-semibold text-white">
                {t("securityCenter.deletionImmediateTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {t("securityCenter.deletionAccess")}
              </p>
            </section>
            <div className="border-t border-slate-800" />
            <section aria-labelledby="deletion-after">
              <h2 id="deletion-after" className="font-semibold text-white">
                {t("securityCenter.deletionAfterTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {t("securityCenter.deletionData")}
              </p>
            </section>
            <div className="border-t border-slate-800" />
            <section aria-labelledby="deletion-other">
              <h2 id="deletion-other" className="font-semibold text-white">
                {t("securityCenter.deletionOtherTitle")}
              </h2>
              <ul className="mt-2 list-disc space-y-3 pl-5 text-sm leading-6 text-slate-300">
                <li>{t("securityCenter.deletionRetention")}</li>
                <li>{t("securityCenter.deletionAdministrator")}</li>
                <li>{t("securityCenter.deletionNotification")}</li>
              </ul>
            </section>
          </div>

          {noticeKey ? (
            <p role="alert" className="text-sm text-rose-300">
              {t(noticeKey)}
            </p>
          ) : null}
          {mfa.isError ? (
            <div role="alert" className="space-y-2 text-sm text-rose-300">
              <p>{t("securityCenter.deletionMfaUnavailable")}</p>
              <button
                type="button"
                onClick={() => void mfa.refetch()}
                className="min-h-11 rounded-lg border border-rose-400/60 px-4 py-2"
              >
                {t("securityCenter.deletionRetry")}
              </button>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              to="/profile"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-4 py-2 text-sm"
            >
              {t("securityCenter.deletionCancel")}
            </Link>
            <button
              ref={continueButton}
              type="button"
              disabled={!canContinue}
              onClick={() => void continueToConfirmation()}
              className="min-h-11 rounded-lg bg-rose-600 px-5 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:bg-rose-950 disabled:text-rose-200"
            >
              {isVerifying
                ? t("securityCenter.deletionVerifying")
                : t("securityCenter.deletionContinue")}
            </button>
          </div>
        </>
      )}

      {confirmationDays !== null && mfa.isSuccess ? (
        <AccountDeletionDialog
          gracePeriodDays={confirmationDays}
          mfaEnabled={mfa.data.enabled}
          onDismiss={dismissConfirmation}
          onPolicyConflict={handlePolicyConflict}
        />
      ) : null}
    </article>
  );
}
