import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  getSecurityConfig,
  listAdminSecurityEvents,
  previewSecurityConfig,
  publishSecurityConfig,
} from "#services/api";

export function AdminSecurityCenter() {
  const client = useQueryClient();
  const config = useQuery({
    queryKey: ["admin-security-config"],
    queryFn: getSecurityConfig,
  });
  const events = useQuery({
    queryKey: ["admin-security-events"],
    queryFn: listAdminSecurityEvents,
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const displayedDraft =
    draft ??
    (config.data ? JSON.stringify(config.data.effective, null, 2) : "");
  const publish = useMutation({
    mutationFn: () =>
      publishSecurityConfig(
        JSON.parse(displayedDraft) as Record<string, unknown>,
        config.data?.revisions.find(
          (revision) => revision.status === "published",
        )?.version ?? 0,
        justification,
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["admin-security-config"] }),
  });
  const preview = useMutation({
    mutationFn: () =>
      previewSecurityConfig(
        JSON.parse(displayedDraft) as Record<string, unknown>,
      ),
  });

  return (
    <section className="mt-7 grid gap-5 xl:grid-cols-2">
      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">
          Configuration de sécurité effective
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Publication atomique, contrôle de version et validation des
          dépendances. Les secrets d’exploitation ne font pas partie de ce
          catalogue.
        </p>
        <textarea
          value={displayedDraft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          className="mt-4 h-96 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 font-mono text-xs text-slate-200"
        />
        <input
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          placeholder="Justification du changement"
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
        />
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => preview.mutate()}
            disabled={!displayedDraft}
            className="rounded-xl border border-sky-500/50 px-4 py-2 font-semibold text-sky-200 disabled:opacity-50"
          >
            Prévisualiser l’impact
          </button>
          <button
            type="button"
            onClick={() => publish.mutate()}
            disabled={!displayedDraft || publish.isPending}
            className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Publier sans redémarrage
          </button>
        </div>
        {preview.data ? (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Impact {preview.data.impact} · {preview.data.changedKeys.length}{" "}
            option(s) modifiée(s) ·{" "}
            {preview.data.affectedAccounts.administratorsRequiringEnrollment}{" "}
            administrateur(s) devront activer le MFA.
            {preview.data.warnings.map((warning) => (
              <p key={warning} className="mt-1">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
        {publish.isError ? (
          <p className="mt-2 text-sm text-rose-300">
            Configuration invalide ou modifiée par un autre administrateur.
          </p>
        ) : null}
      </article>

      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">
          Journal de sécurité
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Les événements sont ordonnés de manière déterministe et la
          consultation est elle-même auditée.
        </p>
        <div className="mt-4 max-h-[32rem] divide-y divide-slate-800 overflow-auto">
          {events.data?.map((event) => (
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
    </section>
  );
}
