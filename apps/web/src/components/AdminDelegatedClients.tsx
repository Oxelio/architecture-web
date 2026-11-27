import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ApiRequestError,
  changeDelegatedClient,
  type DelegatedClient,
  type DelegatedClientCommand,
  type DelegatedClientPolicy,
  type DelegatedResource,
  getDelegatedClients,
  registerDelegatedClient,
} from "#services/api";

const field =
  "w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100";
const button =
  "rounded-xl border border-slate-600 px-4 py-2 font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-50";
const queryKey = ["admin-delegated-clients"];
type CriticalChange = Exclude<DelegatedClientCommand, { kind: "rename" }>;
type Access = "unavailable" | "required" | "optional";

export function AdminDelegatedClients() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: getDelegatedClients });
  const [selected, setSelected] = useState<DelegatedClient>();
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [publicId, setPublicId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; key: string }>();
  const submitting = useRef(false);

  async function perform(action: () => Promise<DelegatedClient>) {
    if (submitting.current) {
      return false;
    }
    submitting.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      const client = await action();
      await queryClient.invalidateQueries({ queryKey });
      setSelected(client);
      setRegistrationOpen(false);
      setPublicId("");
      setName("");
      setNotice({ error: false, key: "delegatedClients.saved" });
      return true;
    } catch (error) {
      const code =
        error instanceof ApiRequestError &&
        error.code.startsWith("delegated_clients.")
          ? error.code.split(".")[1]
          : "unexpected";
      if (code === "revision_conflict") {
        await queryClient.invalidateQueries({ queryKey });
        setSelected(undefined);
      }
      setNotice({ error: true, key: `delegatedClients.errors.${code}` });
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="delegated-clients-title"
      className="space-y-4 rounded-3xl border border-slate-700 bg-slate-900/80 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="delegated-clients-title"
          className="text-xl font-semibold text-white"
        >
          {t("delegatedClients.title")}
        </h2>
        <button
          className={button}
          type="button"
          disabled={busy}
          onClick={() => {
            setRegistrationOpen(!registrationOpen);
            setSelected(undefined);
            setNotice(undefined);
          }}
        >
          {t(
            registrationOpen
              ? "delegatedClients.cancel"
              : "delegatedClients.register",
          )}
        </button>
      </div>
      {query.isPending && <p>{t("common.loading")}</p>}
      {query.isError && (
        <p role="alert">{t("delegatedClients.errors.unexpected")}</p>
      )}
      {notice && (
        <p role={notice.error ? "alert" : "status"}>{t(notice.key)}</p>
      )}
      {registrationOpen && (
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(() =>
              registerDelegatedClient({ publicId, displayName: name }),
            );
          }}
        >
          <label>
            {t("delegatedClients.publicId")}
            <input
              className={field}
              value={publicId}
              onChange={(event) => setPublicId(event.target.value)}
              required
              maxLength={128}
              disabled={busy}
            />
          </label>
          <label>
            {t("delegatedClients.displayName")}
            <input
              className={field}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={160}
              disabled={busy}
            />
          </label>
          <button className={button} type="submit" disabled={busy}>
            {t("delegatedClients.createDisabled")}
          </button>
        </form>
      )}
      {!registrationOpen && query.data && (
        <>
          {query.data.clients.length === 0 ? (
            <p>{t("delegatedClients.empty")}</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {query.data.clients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className={`${button} w-full text-left`}
                    aria-pressed={client.id === selected?.id}
                    disabled={busy}
                    onClick={() => {
                      setSelected(client);
                      setNotice(undefined);
                    }}
                  >
                    <span className="block">{client.displayName}</span>
                    <span className="block break-all text-sm text-slate-400">
                      {client.publicId} ·{" "}
                      {t(
                        client.enabled
                          ? "delegatedClients.enabled"
                          : "delegatedClients.disabled",
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <ClientEditor
              key={`${selected.id}:${selected.revision}`}
              client={selected}
              resources={query.data.resources}
              busy={busy}
              save={(command, confirmation) =>
                perform(() =>
                  changeDelegatedClient(
                    selected.id,
                    selected.revision,
                    command,
                    confirmation,
                  ),
                )
              }
            />
          )}
        </>
      )}
    </section>
  );
}

function ClientEditor({
  client,
  resources,
  busy,
  save,
}: Readonly<{
  client: DelegatedClient;
  resources: DelegatedResource[];
  busy: boolean;
  save: (
    command: DelegatedClientCommand,
    confirmation?: { password: string; mfaCode?: string },
  ) => Promise<boolean>;
}>) {
  const { t } = useTranslation();
  const [name, setName] = useState(client.displayName);
  const [uris, setUris] = useState(client.redirectUris.join("\n"));
  const [policies, setPolicies] = useState(client.policies);
  const [confirmation, setConfirmation] = useState<CriticalChange>();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [explicit, setExplicit] = useState(false);

  function updatePolicy(
    resourceId: string,
    permission: string,
    choice: Access,
  ) {
    const current = policies.find((entry) => entry.resourceId === resourceId);
    const next: DelegatedClientPolicy = {
      resourceId,
      required: (current?.required ?? []).filter((item) => item !== permission),
      optional: (current?.optional ?? []).filter((item) => item !== permission),
    };
    if (choice !== "unavailable") {
      next[choice].push(permission);
    }
    setPolicies([
      ...policies.filter((entry) => entry.resourceId !== resourceId),
      ...(next.required.length || next.optional.length ? [next] : []),
    ]);
  }

  function confirm(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation && explicit) {
      void save(confirmation, {
        password,
        ...(code ? { mfaCode: code } : {}),
      }).then((saved) => {
        if (saved) {
          setConfirmation(undefined);
        }
      });
      setPassword("");
      setCode("");
      setExplicit(false);
    }
  }

  if (confirmation) {
    return (
      <form
        className="space-y-3 rounded-2xl border border-slate-600 p-4"
        onSubmit={confirm}
      >
        <h3 className="font-semibold text-white">
          {t(`delegatedClients.confirm.${confirmation.kind}`, {
            name: client.displayName,
          })}
        </h3>
        {confirmation.kind === "disable" && (
          <p>{t("delegatedClients.permanentRevocation")}</p>
        )}
        {confirmation.kind === "configure" && (
          <dl className="space-y-2">
            <div>
              <dt>{t("delegatedClients.redirectUris")}</dt>
              <dd className="break-all">
                {confirmation.redirectUris.join(", ") || "–"}
              </dd>
            </div>
            {confirmation.policies.map(({ resourceId, required, optional }) => (
              <div key={resourceId}>
                <dt>{resources.find(({ id }) => id === resourceId)?.uri}</dt>
                <dd>
                  {t("delegatedClients.required")} {required.join(", ") || "–"}{" "}
                  · {t("delegatedClients.optional")}{" "}
                  {optional.join(", ") || "–"}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <label className="block">
          {t("delegatedClients.password")}
          <input
            className={field}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="block">
          {t("delegatedClients.mfa")}
          <input
            className={field}
            autoComplete="one-time-code"
            value={code}
            disabled={busy}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={explicit}
            disabled={busy}
            onChange={(event) => setExplicit(event.target.checked)}
          />
          {t("delegatedClients.explicit")}
        </label>
        <div className="flex gap-2">
          <button
            className={button}
            type="submit"
            disabled={busy || !explicit || !password}
          >
            {t("delegatedClients.apply")}
          </button>
          <button
            className={button}
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmation(undefined);
              setPassword("");
              setCode("");
              setExplicit(false);
            }}
          >
            {t("delegatedClients.cancel")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-600 p-4">
      <h3 className="text-lg font-semibold text-white">{client.displayName}</h3>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save({ kind: "rename", displayName: name });
        }}
      >
        <label className="grow">
          {t("delegatedClients.displayName")}
          <input
            className={field}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={160}
            disabled={busy}
          />
        </label>
        <button
          className={button}
          type="submit"
          disabled={busy || name.trim() === client.displayName}
        >
          {t("delegatedClients.rename")}
        </button>
      </form>
      <label className="block">
        {t("delegatedClients.redirectUris")}
        <textarea
          className={field}
          rows={3}
          value={uris}
          disabled={busy}
          onChange={(event) => setUris(event.target.value)}
        />
      </label>
      {resources.map((resource) => (
        <fieldset
          key={resource.id}
          className="space-y-2 rounded-xl border border-slate-700 p-3"
        >
          <legend className="break-all px-1">{resource.uri}</legend>
          {resource.permissions.map(({ code: permission, description }) => {
            const policy = policies.find(
              (entry) => entry.resourceId === resource.id,
            );
            const optionalAccess = policy?.optional.includes(permission)
              ? "optional"
              : "unavailable";
            const access = policy?.required.includes(permission)
              ? "required"
              : optionalAccess;
            return (
              <label key={permission} className="grid gap-1 md:grid-cols-2">
                {description}
                <select
                  className={field}
                  value={access}
                  disabled={busy}
                  onChange={(event) =>
                    updatePolicy(
                      resource.id,
                      permission,
                      event.target.value as Access,
                    )
                  }
                >
                  {(["unavailable", "required", "optional"] as const).map(
                    (option) => (
                      <option key={option} value={option}>
                        {t(`delegatedClients.${option}`)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            );
          })}
        </fieldset>
      ))}
      {!resources.length && <p>{t("delegatedClients.noResources")}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          type="button"
          disabled={busy}
          onClick={() =>
            setConfirmation({
              kind: "configure",
              redirectUris: uris
                .split(/\r?\n/u)
                .map((uri) => uri.trim())
                .filter(Boolean),
              policies,
            })
          }
        >
          {t("delegatedClients.configure")}
        </button>
        <button
          className={button}
          type="button"
          disabled={
            busy ||
            (!client.enabled &&
              (!client.redirectUris.length || !client.policies.length))
          }
          onClick={() =>
            setConfirmation({ kind: client.enabled ? "disable" : "enable" })
          }
        >
          {t(
            client.enabled
              ? "delegatedClients.disable"
              : "delegatedClients.enable",
          )}
        </button>
      </div>
    </div>
  );
}
