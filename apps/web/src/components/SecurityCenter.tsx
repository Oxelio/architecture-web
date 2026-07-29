import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  accountExportDownloadUrl,
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  finalizeMfaEnrollment,
  getMfaStatus,
  listAccountExports,
  listSecurityEvents,
  requestAccountDeletion,
  requestAccountExport,
} from "#services/api";

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white";

export function SecurityCenter() {
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
  const deletion = useMutation({
    mutationFn: () =>
      requestAccountDeletion(password, "DELETE", mfaCode || undefined),
    onSuccess: () => window.location.assign("/"),
  });

  return (
    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-xl font-semibold text-white">
          Authentification multifacteur
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          {mfa.data?.enabled
            ? `Active · ${mfa.data.backupCodesRemaining} codes de secours restants`
            : "Inactive · protégez chaque nouvelle connexion avec TOTP."}
        </p>
        <div className="mt-4 space-y-3">
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe actuel"
          />
          {mfa.data?.enabled || enrollment ? (
            <input
              className={inputClass}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder="Code TOTP ou de secours"
            />
          ) : null}
          {enrollment ? (
            <div className="rounded-2xl bg-white p-4 text-slate-950">
              <img
                src={enrollment.qrCodeDataUrl}
                alt="QR code TOTP"
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
                Valider l’enrôlement
              </button>
            </div>
          ) : mfa.data?.enabled ? (
            <button
              type="button"
              onClick={() => disable.mutate()}
              className="rounded-xl border border-rose-500/40 px-4 py-2 text-rose-300"
            >
              Désactiver le MFA
            </button>
          ) : (
            <button
              type="button"
              onClick={() => enroll.mutate()}
              className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white"
            >
              Configurer le MFA
            </button>
          )}
          {backupCodes.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <strong className="text-amber-200">
                Enregistrez ces codes maintenant
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
                J’ai enregistré ces codes, activer le MFA
              </button>
            </div>
          ) : null}
        </div>
      </article>

      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-xl font-semibold text-white">Données du compte</h3>
        <p className="mt-2 text-sm text-slate-400">
          L’export ZIP est disponible 24 h et disparaît après son premier
          téléchargement.
        </p>
        <button
          type="button"
          onClick={() => createExport.mutate()}
          className="mt-4 rounded-xl bg-violet-500 px-4 py-2 font-semibold text-white"
        >
          Préparer mon export
        </button>
        <div className="mt-4 space-y-2 text-sm">
          {exportsQuery.data?.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 p-3"
            >
              <span>{item.status}</span>
              {item.status === "ready" ? (
                <a
                  href={accountExportDownloadUrl(item.id)}
                  className="font-semibold text-sky-300"
                >
                  Télécharger
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "L’accès sera immédiatement révoqué. Confirmer la demande de suppression ?",
              )
            ) {
              deletion.mutate();
            }
          }}
          className="mt-5 rounded-xl border border-rose-500/40 px-4 py-2 text-rose-300"
        >
          Demander la suppression (14 jours)
        </button>
      </article>

      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 lg:col-span-2">
        <h3 className="text-xl font-semibold text-white">
          Activité de sécurité
        </h3>
        <div className="mt-4 divide-y divide-slate-800">
          {events.data?.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <span className="font-mono text-slate-200">{event.type}</span>
              <span className="text-slate-400">
                {event.result} · {new Date(event.occurred_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
