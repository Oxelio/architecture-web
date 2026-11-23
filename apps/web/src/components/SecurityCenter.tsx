import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  accountExportDownloadUrl,
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  finalizeMfaEnrollment,
  getMfaStatus,
  listAccountExports,
  listSecurityEvents,
  requestAccountExport,
} from "#services/api";

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white";

export function SecurityCenter() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [enrollment, setEnrollment] = useState<Awaited<
    ReturnType<typeof beginMfaEnrollment>
  > | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupConfirmationId, setBackupConfirmationId] = useState<
    string | null
  >(null);
  const mfa = useQuery({ queryKey: ["mfa"], queryFn: getMfaStatus });
  const exportsQuery = useQuery({
    queryKey: ["account-exports"],
    queryFn: listAccountExports,
  });
  const events = useQuery({
    queryKey: ["security-events"],
    queryFn: listSecurityEvents,
  });
  const enroll = useMutation({
    mutationFn: () => beginMfaEnrollment(password),
    onSuccess: setEnrollment,
  });
  const confirm = useMutation({
    mutationFn: () => confirmMfaEnrollment(mfaCode),
    onSuccess: (result) => {
      setBackupCodes(result.backupCodes);
      setBackupConfirmationId(result.confirmationId);
      setEnrollment(null);
    },
  });
  const finalize = useMutation({
    mutationFn: () => finalizeMfaEnrollment(backupConfirmationId ?? ""),
    onSuccess: () => window.location.assign("/signin"),
  });
  const disable = useMutation({
    mutationFn: () => disableMfa(password, mfaCode),
    onSuccess: () => window.location.assign("/signin"),
  });
  const createExport = useMutation({
    mutationFn: () => requestAccountExport(password, mfaCode || undefined),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["account-exports"] }),
  });

  return (
    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-xl font-semibold text-white">
          {t("securityCenter.mfaTitle")}
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          {mfa.data?.enabled
            ? t("securityCenter.mfaEnabled", {
                count: mfa.data.backupCodesRemaining,
              })
            : t("securityCenter.mfaDisabled")}
        </p>
        <div className="mt-4 space-y-3">
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("securityCenter.currentPassword")}
          />
          {mfa.data?.enabled || enrollment ? (
            <input
              className={inputClass}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder={t("securityCenter.mfaCode")}
            />
          ) : null}
          {renderMfaControl()}
          {backupCodes.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <strong className="text-amber-200">
                {t("securityCenter.saveCodesTitle")}
              </strong>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => finalize.mutate()}
                className="mt-4 w-full rounded-xl bg-amber-300 px-4 py-2 font-semibold text-slate-950"
              >
                {t("securityCenter.saveCodesConfirm")}
              </button>
            </div>
          ) : null}
        </div>
      </article>

      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-xl font-semibold text-white">
          {t("securityCenter.dataTitle")}
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          {t("securityCenter.exportDescription")}
        </p>
        <button
          type="button"
          onClick={() => createExport.mutate()}
          className="mt-4 rounded-xl bg-violet-500 px-4 py-2 font-semibold text-white"
        >
          {t("securityCenter.prepareExport")}
        </button>
        <div className="mt-4 space-y-2 text-sm">
          {exportsQuery.data?.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 p-3"
            >
              <span>
                {t(`securityCenter.exportStatus.${item.status}`, {
                  defaultValue: item.status,
                })}
              </span>
              {item.status === "ready" ? (
                <a
                  href={accountExportDownloadUrl(item.id)}
                  className="font-semibold text-sky-300"
                >
                  {t("securityCenter.download")}
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <Link
          to="/profile/deletion"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-rose-500/40 px-4 py-2 text-rose-300 transition hover:border-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
        >
          {t("securityCenter.deleteRequest")}
        </Link>
      </article>

      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 lg:col-span-2">
        <h3 className="text-xl font-semibold text-white">
          {t("securityCenter.activityTitle")}
        </h3>
        <div className="mt-4 divide-y divide-slate-800">
          {events.data?.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <span className="font-mono text-slate-200">{event.type}</span>
              <span className="text-slate-400">
                {t(`securityCenter.eventResult.${event.result}`, {
                  defaultValue: event.result,
                })}{" "}
                · {new Date(event.occurred_at).toLocaleString(i18n.language)}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );

  function renderMfaControl() {
    if (enrollment) {
      return (
        <div className="rounded-2xl bg-white p-4 text-slate-950">
          <img
            src={enrollment.qrCodeDataUrl}
            alt={t("securityCenter.enrollmentQrAlt")}
            className="mx-auto h-48 w-48"
          />
          <p className="break-all text-center font-mono text-xs">
            {enrollment.secret}
          </p>
          <button
            type="button"
            onClick={() => confirm.mutate()}
            className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-2 text-white"
          >
            {t("securityCenter.confirmEnrollment")}
          </button>
        </div>
      );
    }
    if (mfa.data?.enabled) {
      return (
        <button
          type="button"
          onClick={() => disable.mutate()}
          className="rounded-xl border border-rose-500/40 px-4 py-2 text-rose-300"
        >
          {t("securityCenter.disableMfa")}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => enroll.mutate()}
        className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white"
      >
        {t("securityCenter.enableMfa")}
      </button>
    );
  }
}
