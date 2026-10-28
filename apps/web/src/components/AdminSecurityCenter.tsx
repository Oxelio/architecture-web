import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getSecurityConfig,
  listAdminSecurityEvents,
  previewSecurityConfig,
  publishSecurityConfig,
  rollbackSecurityConfig,
  type SecurityConfigCenter,
} from "#services/api";

type CatalogEntry = SecurityConfigCenter["catalog"][number];
type Draft = Record<string, unknown>;

const CATEGORY_ORDER = [
  "accounts",
  "authentication",
  "passwords",
  "sessions",
  "recovery",
  "audit",
] as const;

export function AdminSecurityCenter() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const config = useQuery({
    queryKey: ["admin-security-config"],
    queryFn: getSecurityConfig,
  });
  const events = useQuery({
    queryKey: ["admin-security-events"],
    queryFn: listAdminSecurityEvents,
  });
  const [view, setView] = useState<"configuration" | "history" | "audit">(
    "configuration",
  );
  const [draft, setDraft] = useState<{ values: Draft; version: number } | null>(
    null,
  );
  const [justification, setJustification] = useState("");
  const [confirmedCritical, setConfirmedCritical] = useState(false);
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const effectiveDraft = draft?.values ?? config.data?.effective ?? null;

  const changed = useMemo(
    () =>
      effectiveDraft !== null &&
      config.data !== undefined &&
      JSON.stringify(effectiveDraft) !== JSON.stringify(config.data.effective),
    [config.data, effectiveDraft],
  );

  const preview = useMutation({
    mutationFn: () => previewSecurityConfig(effectiveDraft ?? {}),
  });
  const publish = useMutation({
    mutationFn: () =>
      publishSecurityConfig(
        effectiveDraft ?? {},
        draft?.version ?? currentVersion(config.data),
        justification,
        confirmedCritical,
        { password, mfaCode },
      ),
    onSuccess: async () => {
      setPassword("");
      setMfaCode("");
      setJustification("");
      setConfirmedCritical(false);
      setDraft(null);
      preview.reset();
      await client.invalidateQueries({ queryKey: ["admin-security-config"] });
    },
  });
  const rollback = useMutation({
    mutationFn: (revisionId: string) =>
      rollbackSecurityConfig(revisionId, {
        expectedVersion: currentVersion(config.data),
        justification,
        confirmedCritical,
        password,
        mfaCode,
      }),
    onSuccess: async () => {
      setPassword("");
      setMfaCode("");
      setDraft(null);
      await client.invalidateQueries({ queryKey: ["admin-security-config"] });
    },
  });

  const resetDraft = () => {
    if (config.data) {
      setDraft({
        values: structuredClone(config.data.effective),
        version: currentVersion(config.data),
      });
      preview.reset();
    }
  };

  return (
    <section className="mt-7 space-y-5">
      {view !== "audit" ? (
        <fieldset className="grid gap-3 rounded-xl border border-slate-700 p-4">
          <legend>{t("securityConfig.stepUp")}</legend>
          {view === "history" ? (
            <label>
              {t("securityConfig.justification")}
              <input
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            {t("securityConfig.password")}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            {t("securityConfig.mfaCode")}
            <input
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
            />
          </label>
          {view === "history" ? (
            <label>
              <input
                type="checkbox"
                checked={confirmedCritical}
                onChange={(event) => setConfirmedCritical(event.target.checked)}
              />
              {t("securityConfig.confirm")}
            </label>
          ) : null}
          {rollback.isError ? (
            <p role="alert">{rollback.error.message}</p>
          ) : null}
        </fieldset>
      ) : null}

      <nav
        className="flex flex-wrap gap-2"
        aria-label={t("securityConfig.navigation", {
          defaultValue: "Navigation de la sécurité",
        })}
      >
        {(["configuration", "history", "audit"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={view === item ? "page" : undefined}
            onClick={() => setView(item)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              view === item
                ? "bg-sky-500 text-white"
                : "border border-slate-700 text-slate-300"
            }`}
          >
            {t(`securityConfig.tabs.${item}`, {
              defaultValue:
                item === "configuration"
                  ? "Configuration"
                  : item === "history"
                    ? "Historique"
                    : "Journal d’audit",
            })}
          </button>
        ))}
      </nav>

      {view === "configuration" ? (
        <ConfigurationEditor
          catalog={config.data?.catalog ?? []}
          draft={effectiveDraft}
          onChange={(key, value) =>
            setDraft((current) => ({
              values: setPolicyValue(
                current?.values ?? effectiveDraft ?? {},
                key,
                value,
              ),
              version: current?.version ?? currentVersion(config.data),
            }))
          }
          onReset={resetDraft}
          changed={changed}
          justification={justification}
          onJustificationChange={setJustification}
          confirmedCritical={confirmedCritical}
          onCriticalConfirmationChange={setConfirmedCritical}
          preview={preview}
          publish={publish}
        />
      ) : null}

      {view === "history" ? (
        <History
          revisions={config.data?.revisions ?? []}
          currentVersion={currentVersion(config.data)}
          pending={rollback.isPending}
          onRollback={(id) => rollback.mutate(id)}
        />
      ) : null}

      {view === "audit" ? <Audit events={events.data ?? []} /> : null}
    </section>
  );
}

function ConfigurationEditor({
  catalog,
  draft,
  onChange,
  onReset,
  changed,
  justification,
  onJustificationChange,
  confirmedCritical,
  onCriticalConfirmationChange,
  preview,
  publish,
}: {
  catalog: SecurityConfigCenter["catalog"];
  draft: Draft | null;
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
  changed: boolean;
  justification: string;
  onJustificationChange: (value: string) => void;
  confirmedCritical: boolean;
  onCriticalConfirmationChange: (value: boolean) => void;
  preview: ReturnType<
    typeof useMutation<
      Awaited<ReturnType<typeof previewSecurityConfig>>,
      Error,
      void
    >
  >;
  publish: ReturnType<typeof useMutation<unknown, Error, void>>;
}) {
  const { t, i18n } = useTranslation();
  const critical = preview.data?.impact === "critical";

  return (
    <div className="space-y-5">
      <header className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">
          {t("securityConfig.title", {
            defaultValue: "Configuration de sécurité",
          })}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {t("securityConfig.description", {
            defaultValue:
              "Configurez les fonctionnalités par intention métier. Les changements sont prévisualisés puis publiés atomiquement.",
          })}
        </p>
      </header>

      {CATEGORY_ORDER.map((category) => {
        const entries = catalog.filter((item) => item.category === category);
        return entries.length > 0 ? (
          <fieldset
            key={category}
            className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6"
          >
            <legend className="px-2 text-lg font-semibold text-white">
              {categoryLabel(category, i18n.language)}
            </legend>
            <div className="mt-2 grid gap-4 lg:grid-cols-2">
              {entries.map((entry) => (
                <ConfigField
                  key={entry.key}
                  entry={entry}
                  value={getValue(draft, entry.key)}
                  onChange={(value) => onChange(entry.key, value)}
                  language={i18n.language}
                />
              ))}
            </div>
          </fieldset>
        ) : null;
      })}

      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
        <label
          htmlFor="security-config-justification"
          className="text-sm font-semibold text-white"
        >
          {t("securityConfig.justification", {
            defaultValue: "Motif du changement",
          })}
        </label>
        <textarea
          id="security-config-justification"
          value={justification}
          onChange={(event) => onJustificationChange(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onReset}
            disabled={!changed}
            className="rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-200 disabled:opacity-50"
          >
            {t("securityConfig.reset", {
              defaultValue: "Annuler les modifications",
            })}
          </button>
          <button
            type="button"
            onClick={() => preview.mutate()}
            disabled={!changed || preview.isPending}
            className="rounded-xl border border-sky-500/50 px-4 py-2 font-semibold text-sky-200 disabled:opacity-50"
          >
            {t("securityConfig.preview", {
              defaultValue: "Prévisualiser l’impact",
            })}
          </button>
        </div>

        {preview.data ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-semibold">
              {preview.data.changedKeys.length} option(s) modifiée(s) · impact{" "}
              {preview.data.impact}
            </p>
            <ul className="mt-2 space-y-1">
              {preview.data.changes.map((change) => (
                <li key={change.key}>
                  {fieldLabel(change.key, i18n.language)} :{" "}
                  <code>{formatValue(change.before)}</code> →{" "}
                  <code>{formatValue(change.after)}</code>
                </li>
              ))}
            </ul>
            {preview.data.warnings.map((warning) => (
              <p key={warning} className="mt-2">
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        {critical ? (
          <label className="mt-4 flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            <input
              type="checkbox"
              checked={confirmedCritical}
              onChange={(event) =>
                onCriticalConfirmationChange(event.target.checked)
              }
              className="mt-1"
            />
            Je confirme avoir examiné les conséquences de cette modification
            critique.
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => publish.mutate()}
          disabled={
            !preview.data ||
            !justification.trim() ||
            (critical && !confirmedCritical) ||
            publish.isPending
          }
          className="mt-4 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {t("securityConfig.publish", {
            defaultValue: "Publier sans redémarrage",
          })}
        </button>
        {preview.isError || publish.isError ? (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {t("securityConfig.error", {
              defaultValue:
                "La configuration est invalide, incomplète ou a été modifiée par un autre administrateur.",
            })}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function ConfigField({
  entry,
  value,
  onChange,
  language,
}: {
  entry: CatalogEntry;
  value: unknown;
  onChange: (value: unknown) => void;
  language: string;
}) {
  const id = `security-${entry.key.replaceAll(".", "-")}`;
  const disabled = !entry.availability.available || entry.availability.readOnly;
  const label = fieldLabel(entry.key, language);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor={id} className="font-semibold text-slate-100">
            {label}
          </label>
          <p className="mt-1 text-xs text-slate-400">
            {fieldDescription(entry.key, language)}
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase text-slate-400">
          {entry.impact}
        </span>
      </div>

      <div className="mt-3">
        {entry.control === "switch" ? (
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="h-5 w-10 accent-sky-500"
          />
        ) : null}
        {entry.control === "select" ? (
          <select
            id={id}
            value={String(value ?? "")}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            {entry.constraints?.choices?.map((choice) => (
              <option key={choice} value={choice}>
                {choiceLabel(choice, language)}
              </option>
            ))}
          </select>
        ) : null}
        {entry.control === "multi-select" ? (
          <div className="flex flex-wrap gap-3">
            {entry.constraints?.choices?.map((choice) => {
              const values = Array.isArray(value) ? value : [];
              return (
                <label key={choice} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={values.includes(choice)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...values, choice]
                          : values.filter((item) => item !== choice),
                      )
                    }
                  />
                  {choiceLabel(choice, language)}
                </label>
              );
            })}
          </div>
        ) : null}
        {entry.control === "number" || entry.control === "slider-number" ? (
          <div className="flex items-center gap-3">
            {entry.control === "slider-number" ? (
              <input
                aria-label={`${label} — curseur`}
                type="range"
                min={entry.constraints?.min}
                max={entry.constraints?.max}
                step={entry.constraints?.step}
                value={Number(value ?? entry.constraints?.min ?? 0)}
                disabled={disabled}
                onChange={(event) => onChange(Number(event.target.value))}
                className="min-w-0 flex-1 accent-sky-500"
              />
            ) : null}
            <input
              id={id}
              type="number"
              min={entry.constraints?.min}
              max={entry.constraints?.max}
              step={entry.constraints?.step}
              value={Number(value ?? 0)}
              disabled={disabled}
              onChange={(event) => onChange(Number(event.target.value))}
              className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            />
            <span className="text-xs text-slate-400">
              {unitLabel(entry.constraints?.unit, language)}
            </span>
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {language.startsWith("en") ? "Recommended" : "Recommandé"} :{" "}
        {formatValue(entry.recommendedValue)}
      </p>
      {disabled ? (
        <p className="mt-2 text-xs text-amber-300">
          {language.startsWith("en")
            ? "Read-only: no executable consumer currently applies this option."
            : "Lecture seule : aucun consommateur exécutable n’applique actuellement cette option."}
        </p>
      ) : null}
    </div>
  );
}

function History({
  revisions,
  currentVersion,
  pending,
  onRollback,
}: {
  revisions: SecurityConfigCenter["revisions"];
  currentVersion: number;
  pending: boolean;
  onRollback: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
      <h2 className="text-xl font-semibold text-white">
        Historique des révisions
      </h2>
      <div className="mt-4 divide-y divide-slate-800">
        {revisions.map((revision) => (
          <div
            key={revision.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <div>
              <p className="font-semibold text-slate-200">
                Révision {revision.version} · {revision.status}
              </p>
              <p className="text-xs text-slate-500">
                {revision.created_by} ·{" "}
                {new Date(revision.created_at).toLocaleString()}
              </p>
              <p>
                {revision.justification ??
                  t("securityConfig.notRecorded", {
                    defaultValue: "Not recorded",
                  })}{" "}
                ·{" "}
                {revision.origin ??
                  t("securityConfig.notRecorded", {
                    defaultValue: "Not recorded",
                  })}
              </p>
              {revision.changes?.map((change) => (
                <p key={change.key}>
                  {t(`securityConfig.fields.${change.key}.label`, {
                    defaultValue: change.key,
                  })}
                  : {JSON.stringify(change.before)} →{" "}
                  {JSON.stringify(change.after)}
                </p>
              ))}
            </div>
            {revision.version !== currentVersion ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onRollback(revision.id)}
                className="rounded-xl border border-slate-700 px-3 py-2 text-slate-200 disabled:opacity-50"
              >
                Restaurer
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

function Audit({
  events,
}: {
  events: Awaited<ReturnType<typeof listAdminSecurityEvents>>;
}) {
  return (
    <article className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
      <h2 className="text-xl font-semibold text-white">Journal de sécurité</h2>
      <div className="mt-4 max-h-[38rem] divide-y divide-slate-800 overflow-auto">
        {events.map((event) => (
          <div key={event.id} className="py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-mono text-slate-200">{event.type}</span>
              <span
                className={
                  event.result === "success"
                    ? "text-emerald-300"
                    : "text-rose-300"
                }
              >
                {event.result}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {event.actor_type} ·{" "}
              {new Date(event.occurred_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function currentVersion(config: SecurityConfigCenter | undefined): number {
  return config?.effectiveRevision.version ?? 0;
}

function getValue(source: Draft | null, key: string): unknown {
  return key.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    return (value as Draft)[segment];
  }, source);
}

function setValue(source: Draft, key: string, value: unknown): Draft {
  const result = structuredClone(source);
  const segments = key.split(".");
  let target = result;
  for (const segment of segments.slice(0, -1)) {
    const next = target[segment];
    if (!next || typeof next !== "object") {
      target[segment] = {};
    }
    target = target[segment] as Draft;
  }
  const last = segments.at(-1);
  if (last) {
    target[last] = value;
  }
  return result;
}

function setPolicyValue(source: Draft, key: string, value: unknown): Draft {
  let result = setValue(source, key, value);
  if (
    key === "passwords.standardMinLength" ||
    key === "passwords.standardMinimumStrength"
  ) {
    result = setValue(result, "passwords.standardLevel", "custom");
  }
  if (
    key === "passwords.privilegedMinLength" ||
    key === "passwords.privilegedMinimumStrength"
  ) {
    result = setValue(result, "passwords.privilegedLevel", "custom");
  }
  if (
    (key === "passwords.standardLevel" ||
      key === "passwords.privilegedLevel") &&
    typeof value === "string" &&
    value !== "custom"
  ) {
    const presets = {
      standard: { length: 12, strength: "weak" },
      elevated: { length: 15, strength: "acceptable" },
      critical: { length: 20, strength: "strong" },
    } as const;
    const preset = presets[value as keyof typeof presets];
    if (preset) {
      const privileged = key === "passwords.privilegedLevel";
      result = setValue(
        result,
        privileged
          ? "passwords.privilegedMinLength"
          : "passwords.standardMinLength",
        preset.length,
      );
      result = setValue(
        result,
        privileged
          ? "passwords.privilegedMinimumStrength"
          : "passwords.standardMinimumStrength",
        preset.strength,
      );
    }
  }
  return result;
}

function formatValue(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") || "—" : String(value ?? "—");
}

function categoryLabel(category: string, language: string): string {
  const labels: Record<string, [string, string]> = {
    accounts: ["Comptes", "Accounts"],
    authentication: ["Authentification", "Authentication"],
    passwords: ["Mots de passe", "Passwords"],
    sessions: ["Sessions", "Sessions"],
    recovery: ["Récupération", "Recovery"],
    audit: ["Audit", "Audit"],
  };
  return labels[category]?.[language.startsWith("en") ? 1 : 0] ?? category;
}

function fieldLabel(key: string, language: string): string {
  const labels: Record<string, [string, string]> = {
    "accounts.publicRegistration": ["Inscription publique", "Public sign-up"],
    "accounts.allowedLoginIdentifiers": [
      "Identifiants de connexion autorisés",
      "Allowed login identifiers",
    ],
    "accounts.emailVerification": [
      "Vérification de l’adresse email",
      "Email verification",
    ],
    "accounts.emailChange": ["Changement d’adresse email", "Email change"],
    "accounts.export": ["Export du compte", "Account export"],
    "accounts.deletion": ["Suppression du compte", "Account deletion"],
    "accounts.deletionGraceDays": [
      "Délai avant suppression",
      "Deletion grace period",
    ],
    "authentication.mfaAvailable": ["MFA disponible", "MFA available"],
    "authentication.mfaRequiredRoles": [
      "Rôles soumis au MFA",
      "MFA-required roles",
    ],
    "authentication.mfaChallengeMinutes": [
      "Durée du challenge MFA",
      "MFA challenge duration",
    ],
    "authentication.mfaMaxAttempts": [
      "Tentatives MFA maximales",
      "Maximum MFA attempts",
    ],
    "authentication.recentAuthenticationMinutes": [
      "Authentification considérée récente",
      "Recent authentication window",
    ],
    "passwords.standardLevel": ["Niveau standard", "Standard level"],
    "passwords.privilegedLevel": ["Niveau privilégié", "Privileged level"],
    "passwords.standardMinLength": [
      "Longueur minimale standard",
      "Standard minimum length",
    ],
    "passwords.privilegedMinLength": [
      "Longueur minimale privilégiée",
      "Privileged minimum length",
    ],
    "passwords.maxLength": ["Longueur maximale", "Maximum length"],
    "passwords.standardMinimumStrength": [
      "Robustesse minimale standard",
      "Standard minimum strength",
    ],
    "passwords.privilegedMinimumStrength": [
      "Robustesse minimale privilégiée",
      "Privileged minimum strength",
    ],
    "passwords.checkCommonPasswords": [
      "Refuser les mots de passe courants",
      "Reject common passwords",
    ],
    "passwords.checkCompromisedPasswords": [
      "Refuser les mots de passe compromis",
      "Reject compromised passwords",
    ],
    "passwords.checkUserContext": [
      "Vérifier le contexte utilisateur",
      "Check user context",
    ],
    "passwords.rejectCurrentPassword": [
      "Refuser le mot de passe actuel",
      "Reject current password",
    ],
    "passwords.requireUppercase": ["Exiger une majuscule", "Require uppercase"],
    "passwords.requireLowercase": ["Exiger une minuscule", "Require lowercase"],
    "passwords.requireNumber": ["Exiger un nombre", "Require a number"],
    "passwords.requireSpecialCharacter": [
      "Exiger un caractère spécial",
      "Require a special character",
    ],
    "sessions.userManagement": [
      "Gestion des sessions par l’utilisateur",
      "User session management",
    ],
    "sessions.durationMinutes": ["Durée d’une session", "Session duration"],
    "recovery.enabled": ["Récupération de compte", "Account recovery"],
    "recovery.tokenMinutes": [
      "Validité du lien de récupération",
      "Recovery link validity",
    ],
    "recovery.requestsPerHour": [
      "Demandes de récupération par heure",
      "Recovery requests per hour",
    ],
    "audit.consultation": ["Consultation de l’audit", "Audit consultation"],
    "audit.retentionDays": ["Durée de conservation", "Retention period"],
  };
  return labels[key]?.[language.startsWith("en") ? 1 : 0] ?? key;
}

function fieldDescription(key: string, language: string): string {
  const suffix = language.startsWith("en")
    ? "This value is applied by the server after publication."
    : "Cette valeur est appliquée par le serveur après publication.";
  return `${fieldLabel(key, language)}. ${suffix}`;
}

function choiceLabel(choice: string, language: string): string {
  const values: Record<string, [string, string]> = {
    username: ["Pseudonyme", "Username"],
    email: ["Adresse email", "Email address"],
    user: ["Utilisateurs", "Users"],
    admin: ["Administrateurs", "Administrators"],
    standard: ["Standard", "Standard"],
    elevated: ["Renforcé", "Elevated"],
    critical: ["Critique", "Critical"],
    custom: ["Personnalisé", "Custom"],
    too_weak: ["Très faible", "Too weak"],
    weak: ["Faible", "Weak"],
    acceptable: ["Acceptable", "Acceptable"],
    strong: ["Forte", "Strong"],
    very_strong: ["Très forte", "Very strong"],
  };
  return values[choice]?.[language.startsWith("en") ? 1 : 0] ?? choice;
}

function unitLabel(unit: string | undefined, language: string): string {
  if (!unit) {
    return "";
  }
  const units: Record<string, [string, string]> = {
    minutes: ["minutes", "minutes"],
    days: ["jours", "days"],
    characters: ["caractères", "characters"],
    attempts: ["tentatives", "attempts"],
    requests: ["demandes", "requests"],
  };
  return units[unit]?.[language.startsWith("en") ? 1 : 0] ?? unit;
}
